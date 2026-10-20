using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Web.Script.Serialization;
using System.Windows.Automation;
using System.Windows.Forms;

/// <summary>Windows computer-use helper. JSON lines in, JSON lines out. No PowerShell.</summary>
static class NativeInput {
    [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
    [DllImport("user32.dll")] public static extern void mouse_event(int flags, int dx, int dy, int data, int extra);
    public const int LeftDown = 0x0002;
    public const int LeftUp = 0x0004;
    public const int Wheel = 0x0800;
}

static class AgentCursor {
    const int WsExTransparent = 0x20;
    const int WsExToolWindow = 0x80;
    const int WsExNoActivate = 0x08000000;
    const int WsExTopMost = 0x8;
    static readonly ManualResetEvent Ready = new ManualResetEvent(false);
    static CursorForm Form;
    static System.Windows.Forms.Timer HideTimer;

    sealed class CursorForm : Form {
        protected override bool ShowWithoutActivation { get { return true; } }
        protected override CreateParams CreateParams {
            get {
                var cp = base.CreateParams;
                cp.ExStyle |= WsExTransparent | WsExToolWindow | WsExNoActivate | WsExTopMost;
                return cp;
            }
        }
        public CursorForm() {
            FormBorderStyle = FormBorderStyle.None;
            ShowInTaskbar = false;
            TopMost = true;
            StartPosition = FormStartPosition.Manual;
            BackColor = Color.Magenta;
            TransparencyKey = Color.Magenta;
            Size = new Size(22, 26);
            DoubleBuffered = true;
        }
        protected override void OnPaint(PaintEventArgs e) {
            var g = e.Graphics;
            g.SmoothingMode = System.Drawing.Drawing2D.SmoothingMode.AntiAlias;
            var arrow = new[] {
                new Point(2, 1), new Point(2, 18), new Point(7, 13),
                new Point(12, 22), new Point(15, 20), new Point(10, 12), new Point(18, 12)
            };
            using (var shadow = new SolidBrush(Color.FromArgb(90, 0, 0, 0)))
                g.FillPolygon(shadow, new[] {
                    new Point(3, 2), new Point(3, 19), new Point(8, 14),
                    new Point(13, 23), new Point(16, 21), new Point(11, 13), new Point(19, 13)
                });
            using (var fill = new SolidBrush(Color.White))
                g.FillPolygon(fill, arrow);
            using (var pen = new Pen(Color.FromArgb(37, 99, 235), 1.4f))
                g.DrawPolygon(pen, arrow);
        }
    }

    public static void Show(int x, int y) {
        Ensure();
        if (!Ready.WaitOne(800) || Form == null) return;
        try {
            Form.BeginInvoke((MethodInvoker)delegate {
                Form.Location = new Point(Math.Max(0, x - 2), Math.Max(0, y - 1));
                Form.Invalidate();
                if (!Form.Visible) Form.Show();
                HideTimer.Stop();
                HideTimer.Interval = 500;
                HideTimer.Start();
            });
        } catch (Exception) { }
    }

    static void Ensure() {
        if (Form != null) return;
        var thread = new Thread(new ThreadStart(delegate {
            Form = new CursorForm();
            var created = Form.Handle;
            if (created == IntPtr.Zero) return;
            HideTimer = new System.Windows.Forms.Timer();
            HideTimer.Interval = 500;
            HideTimer.Tick += delegate { HideTimer.Stop(); if (Form != null) Form.Hide(); };
            Ready.Set();
            Application.Run();
        }));
        thread.IsBackground = true;
        thread.SetApartmentState(ApartmentState.STA);
        thread.Start();
    }
}

sealed class Program {
    static readonly JavaScriptSerializer Json = new JavaScriptSerializer();
    static readonly List<AutomationElement> Elements = new List<AutomationElement>();
    const int MaxNodes = 500;

    static void Main() {
        Console.InputEncoding = Encoding.UTF8;
        Console.OutputEncoding = Encoding.UTF8;
        string line;
        while ((line = Console.In.ReadLine()) != null) {
            if (string.IsNullOrWhiteSpace(line)) continue;
            object id = 0;
            try {
                var msg = Json.Deserialize<Dictionary<string, object>>(line);
                if (msg != null && msg.ContainsKey("id")) id = msg["id"];
                var op = msg != null && msg.ContainsKey("op") ? Convert.ToString(msg["op"]) : "";
                var args = ArgsOf(msg);
                Emit(id, true, Dispatch(op, args), null);
            } catch (Exception ex) {
                Emit(id, false, null, ex.GetBaseException().Message);
            }
        }
    }

    static Dictionary<string, object> ArgsOf(Dictionary<string, object> msg) {
        object raw;
        if (msg != null && msg.TryGetValue("args", out raw) && raw is Dictionary<string, object>) {
            return (Dictionary<string, object>)raw;
        }
        return new Dictionary<string, object>();
    }

    static object Arg(Dictionary<string, object> args, string name) {
        object value;
        return args != null && args.TryGetValue(name, out value) ? value : null;
    }

    static int? ArgInt(Dictionary<string, object> args, string name) {
        var value = Arg(args, name);
        if (value == null || value is string && ((string)value).Length == 0) return null;
        return Convert.ToInt32(value);
    }

    static void Emit(object id, bool ok, object result, string error) {
        var payload = new Dictionary<string, object> { { "id", id }, { "ok", ok } };
        if (ok) payload["result"] = result;
        else payload["error"] = error ?? "dsh-uia failed";
        Console.Out.WriteLine(Json.Serialize(payload));
        Console.Out.Flush();
    }

    static Dictionary<string, object> Dispatch(string op, Dictionary<string, object> args) {
        switch (op) {
            case "list_apps": return ListApps();
            case "list_windows": return ListWindows(args);
            case "get_state": return GetState(args);
            case "click": return Click(args);
            case "type_text":
            case "paste": return TypeText(args);
            case "press_key": return PressKey(args);
            case "scroll": return Scroll(args);
            case "drag": return Drag(args);
            case "set_value": return SetValue(args);
            case "select_text": return SelectText(args);
            case "perform_secondary_action": return Perform(args);
            case "screenshot": return Screenshot(args);
            default: throw new InvalidOperationException("unsupported action \"" + op + "\"");
        }
    }

    static Process FindApp(string name) {
        if (string.IsNullOrWhiteSpace(name)) throw new InvalidOperationException("app is required");
        var needle = name.ToLowerInvariant();
        Process fuzzy = null;
        foreach (var proc in Process.GetProcesses()) {
            try {
                if (proc.MainWindowHandle == IntPtr.Zero) continue;
                if (string.Equals(proc.ProcessName, name, StringComparison.Ordinal) ||
                    string.Equals(proc.MainWindowTitle, name, StringComparison.Ordinal)) return proc;
                var processName = (proc.ProcessName ?? "").ToLowerInvariant();
                var title = (proc.MainWindowTitle ?? "").ToLowerInvariant();
                if (fuzzy == null && (processName.Contains(needle) || title.Contains(needle))) fuzzy = proc;
            } catch (InvalidOperationException) { }
        }
        if (fuzzy != null) return fuzzy;
        throw new InvalidOperationException("no running app matches \"" + name + "\"");
    }

    static AutomationElementCollection WindowsOf(int pid) {
        var condition = new PropertyCondition(AutomationElement.ProcessIdProperty, pid);
        return AutomationElement.RootElement.FindAll(TreeScope.Children, condition);
    }

    static Dictionary<string, object> ListApps() {
        var apps = new List<Dictionary<string, object>>();
        var lines = new List<string>();
        foreach (var proc in Process.GetProcesses()) {
            try {
                if (proc.MainWindowHandle == IntPtr.Zero) continue;
                apps.Add(new Dictionary<string, object> {
                    { "name", proc.ProcessName ?? "" },
                    { "pid", proc.Id },
                    { "title", proc.MainWindowTitle ?? "" },
                });
                lines.Add(proc.Id + "\t" + proc.ProcessName + "\t" + proc.MainWindowTitle);
            } catch (InvalidOperationException) { }
        }
        return new Dictionary<string, object> { { "text", string.Join("\n", lines.ToArray()) }, { "apps", apps } };
    }

    static Dictionary<string, object> ListWindows(Dictionary<string, object> args) {
        var proc = FindApp(Convert.ToString(Arg(args, "app")));
        var found = WindowsOf(proc.Id);
        var rows = new List<Dictionary<string, object>>();
        var lines = new List<string>();
        for (var i = 0; i < found.Count; i++) {
            var title = found[i].Current.Name ?? "";
            rows.Add(new Dictionary<string, object> { { "index", i }, { "title", title } });
            lines.Add(i + "\t" + title);
        }
        return new Dictionary<string, object> {
            { "text", lines.Count == 0 ? "No windows." : string.Join("\n", lines.ToArray()) },
            { "windows", rows },
        };
    }

    static void Walk(AutomationElement element, int depth, List<string> lines) {
        if (element == null || Elements.Count >= MaxNodes || depth > 16) return;
        var index = Elements.Count;
        Elements.Add(element);
        var role = element.Current.ControlType.ProgrammaticName ?? "unknown";
        var name = (element.Current.Name ?? "").Replace("\r", " ").Replace("\n", " ");
        lines.Add(new string(' ', depth * 2) + "[" + index + "] " + role + " " + name);
        var walker = TreeWalker.ControlViewWalker;
        var child = walker.GetFirstChild(element);
        while (child != null) {
            Walk(child, depth + 1, lines);
            child = walker.GetNextSibling(child);
        }
    }

    static Dictionary<string, object> GetState(Dictionary<string, object> args) {
        var proc = FindApp(Convert.ToString(Arg(args, "app")));
        Elements.Clear();
        var windows = WindowsOf(proc.Id);
        AutomationElement start;
        if (windows.Count == 0) start = AutomationElement.FromHandle(proc.MainWindowHandle);
        else start = windows[0];
        var wanted = ArgInt(args, "window_id");
        if (wanted != null) {
            if (wanted.Value < 0 || wanted.Value >= windows.Count) {
                throw new InvalidOperationException("window_id " + wanted.Value + " is out of range");
            }
            start = windows[wanted.Value];
        }
        if (start == null) throw new InvalidOperationException("the app has no UI Automation window");
        var lines = new List<string>();
        Walk(start, 0, lines);
        return new Dictionary<string, object> { { "text", string.Join("\n", lines.ToArray()) }, { "count", Elements.Count } };
    }

    static AutomationElement ElementAt(object index) {
        if (index == null) throw new InvalidOperationException("element_index is required");
        var i = Convert.ToInt32(index);
        if (i < 0 || i >= Elements.Count) {
            throw new InvalidOperationException("element_index " + i + " is not in the last get_state tree. Read get_state again.");
        }
        return Elements[i];
    }

    static object TryPattern(AutomationElement element, AutomationPattern pattern) {
        object value;
        return element.TryGetCurrentPattern(pattern, out value) ? value : null;
    }

    static void Mark(int x, int y) {
        AgentCursor.Show(x, y);
        NativeInput.SetCursorPos(x, y);
        Thread.Sleep(160);
    }

    static void MarkElement(AutomationElement element) {
        var rect = element.Current.BoundingRectangle;
        if (rect.Width <= 0 || rect.Height <= 0) return;
        Mark((int)(rect.X + rect.Width / 2), (int)(rect.Y + rect.Height / 2));
    }

    static void ClickPoint(int x, int y) {
        Mark(x, y);
        NativeInput.mouse_event(NativeInput.LeftDown, 0, 0, 0, 0);
        NativeInput.mouse_event(NativeInput.LeftUp, 0, 0, 0, 0);
    }

    static void ClickElement(AutomationElement element) {
        MarkElement(element);
        var invoke = TryPattern(element, InvokePattern.Pattern) as InvokePattern;
        if (invoke != null) { invoke.Invoke(); return; }
        var toggle = TryPattern(element, TogglePattern.Pattern) as TogglePattern;
        if (toggle != null) { toggle.Toggle(); return; }
        var rect = element.Current.BoundingRectangle;
        if (rect.Width <= 0 || rect.Height <= 0) throw new InvalidOperationException("element has no box to click");
        NativeInput.mouse_event(NativeInput.LeftDown, 0, 0, 0, 0);
        NativeInput.mouse_event(NativeInput.LeftUp, 0, 0, 0, 0);
    }

    static Dictionary<string, object> Click(Dictionary<string, object> args) {
        var index = Arg(args, "element_index");
        if (index != null) {
            ClickElement(ElementAt(index));
            return new Dictionary<string, object> { { "text", "clicked " + Convert.ToInt32(index) } };
        }
        var x = Arg(args, "x");
        var y = Arg(args, "y");
        if (x == null || y == null) throw new InvalidOperationException("click needs either `element_index` or both `x` and `y`");
        ClickPoint(Convert.ToInt32(x), Convert.ToInt32(y));
        return new Dictionary<string, object> { { "text", "clicked " + x + ", " + y } };
    }

    static string EscapeSendKeys(string text) {
        var specials = "+^%~(){}[]";
        var builder = new StringBuilder();
        foreach (var ch in text ?? "") {
            if (specials.IndexOf(ch) >= 0) builder.Append('{').Append(ch).Append('}');
            else builder.Append(ch);
        }
        return builder.ToString();
    }

    static Dictionary<string, object> SetValue(Dictionary<string, object> args) {
        var element = ElementAt(Arg(args, "element_index"));
        var value = Convert.ToString(Arg(args, "value")) ?? "";
        var pattern = TryPattern(element, ValuePattern.Pattern) as ValuePattern;
        if (pattern != null && !pattern.Current.IsReadOnly) {
            pattern.SetValue(value);
            return new Dictionary<string, object> { { "text", "set value" } };
        }
        ClickElement(element);
        SendKeys.SendWait(EscapeSendKeys(value));
        return new Dictionary<string, object> { { "text", "set value" } };
    }

    static Dictionary<string, object> TypeText(Dictionary<string, object> args) {
        var index = Arg(args, "element_index");
        if (index != null) ClickElement(ElementAt(index));
        var text = Convert.ToString(Arg(args, "text")) ?? "";
        if (text.Length > 0) SendKeys.SendWait(EscapeSendKeys(text));
        return new Dictionary<string, object> { { "text", "typed" } };
    }

    static Dictionary<string, object> PressKey(Dictionary<string, object> args) {
        var raw = (Convert.ToString(Arg(args, "key")) ?? "").ToLowerInvariant();
        var parts = raw.Split(new[] { '+' }, StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length == 0) throw new InvalidOperationException("key is required");
        var prefix = "";
        for (var i = 0; i < parts.Length - 1; i++) {
            switch (parts[i]) {
                case "ctrl":
                case "control": prefix += "^"; break;
                case "shift": prefix += "+"; break;
                case "alt":
                case "option": prefix += "%"; break;
                default: throw new InvalidOperationException("unsupported key \"" + raw + "\"");
            }
        }
        var key = parts[parts.Length - 1];
        string body;
        switch (key) {
            case "return":
            case "enter": body = "{ENTER}"; break;
            case "tab": body = "{TAB}"; break;
            case "escape":
            case "esc": body = "{ESC}"; break;
            case "space": body = " "; break;
            case "delete": body = "{DEL}"; break;
            case "backspace": body = "{BS}"; break;
            case "up": body = "{UP}"; break;
            case "down": body = "{DOWN}"; break;
            case "left": body = "{LEFT}"; break;
            case "right": body = "{RIGHT}"; break;
            default:
                if (key.Length != 1) throw new InvalidOperationException("unsupported key \"" + raw + "\"");
                body = EscapeSendKeys(key);
                break;
        }
        SendKeys.SendWait(prefix + body);
        return new Dictionary<string, object> { { "text", "pressed " + raw } };
    }

    static Dictionary<string, object> Scroll(Dictionary<string, object> args) {
        var direction = (Convert.ToString(Arg(args, "direction")) ?? "down").ToLowerInvariant();
        var pages = ArgInt(args, "pages") ?? 1;
        if (pages < 1) pages = 1;
        var index = Arg(args, "element_index");
        if (index != null) {
            var rect = ElementAt(index).Current.BoundingRectangle;
            ClickPoint((int)(rect.X + rect.Width / 2), (int)(rect.Y + rect.Height / 2));
        }
        var delta = pages * 120;
        int amount;
        switch (direction) {
            case "up":
            case "u": amount = delta; break;
            case "down":
            case "d": amount = -delta; break;
            default: throw new InvalidOperationException("unsupported scroll direction \"" + direction + "\"");
        }
        NativeInput.mouse_event(NativeInput.Wheel, 0, 0, amount, 0);
        return new Dictionary<string, object> { { "text", "scrolled " + direction } };
    }

    static Dictionary<string, object> Drag(Dictionary<string, object> args) {
        foreach (var name in new[] { "from_x", "from_y", "to_x", "to_y" }) {
            if (Arg(args, name) == null) throw new InvalidOperationException("drag needs from_x, from_y, to_x and to_y");
        }
        var x1 = Convert.ToInt32(Arg(args, "from_x"));
        var y1 = Convert.ToInt32(Arg(args, "from_y"));
        var x2 = Convert.ToInt32(Arg(args, "to_x"));
        var y2 = Convert.ToInt32(Arg(args, "to_y"));
        Mark(x1, y1);
        NativeInput.mouse_event(NativeInput.LeftDown, 0, 0, 0, 0);
        Mark(x2, y2);
        NativeInput.mouse_event(NativeInput.LeftUp, 0, 0, 0, 0);
        return new Dictionary<string, object> { { "text", "dragged" } };
    }

    static Dictionary<string, object> SelectText(Dictionary<string, object> args) {
        var element = ElementAt(Arg(args, "element_index"));
        var text = Convert.ToString(Arg(args, "text")) ?? "";
        var pattern = TryPattern(element, TextPattern.Pattern) as TextPattern;
        if (pattern == null) throw new InvalidOperationException("select_text is not supported on this element");
        var range = pattern.DocumentRange.FindText(text, false, false);
        if (range == null) throw new InvalidOperationException("text was not found in the element");
        range.Select();
        return new Dictionary<string, object> { { "text", "selected text" } };
    }

    static Dictionary<string, object> Perform(Dictionary<string, object> args) {
        var element = ElementAt(Arg(args, "element_index"));
        var name = Convert.ToString(Arg(args, "action_name"));
        if (string.IsNullOrWhiteSpace(name)) name = "Invoke";
        switch (name.ToLowerInvariant()) {
            case "invoke":
            case "press":
                var invoke = TryPattern(element, InvokePattern.Pattern) as InvokePattern;
                if (invoke == null) throw new InvalidOperationException("accessibility action " + name + " failed");
                invoke.Invoke();
                break;
            case "toggle":
                var toggle = TryPattern(element, TogglePattern.Pattern) as TogglePattern;
                if (toggle == null) throw new InvalidOperationException("accessibility action " + name + " failed");
                toggle.Toggle();
                break;
            case "expand":
                var expand = TryPattern(element, ExpandCollapsePattern.Pattern) as ExpandCollapsePattern;
                if (expand == null) throw new InvalidOperationException("accessibility action " + name + " failed");
                expand.Expand();
                break;
            case "collapse":
                var collapse = TryPattern(element, ExpandCollapsePattern.Pattern) as ExpandCollapsePattern;
                if (collapse == null) throw new InvalidOperationException("accessibility action " + name + " failed");
                collapse.Collapse();
                break;
            default:
                throw new InvalidOperationException("unsupported action \"" + name + "\"");
        }
        return new Dictionary<string, object> { { "text", "performed " + name } };
    }

    static Dictionary<string, object> Screenshot(Dictionary<string, object> args) {
        var proc = FindApp(Convert.ToString(Arg(args, "app")));
        var element = AutomationElement.FromHandle(proc.MainWindowHandle);
        if (element == null) throw new InvalidOperationException("the app has no window to capture");
        var rect = element.Current.BoundingRectangle;
        var width = Math.Max(1, (int)rect.Width);
        var height = Math.Max(1, (int)rect.Height);
        using (var bitmap = new Bitmap(width, height))
        using (var graphics = Graphics.FromImage(bitmap)) {
            graphics.CopyFromScreen((int)rect.X, (int)rect.Y, 0, 0, new Size(width, height));
            var path = Path.Combine(Path.GetTempPath(), "dsh-uia-" + DateTime.UtcNow.Ticks + ".png");
            bitmap.Save(path, ImageFormat.Png);
            return new Dictionary<string, object> { { "text", "screenshot saved to " + path }, { "path", path } };
        }
    }
}
