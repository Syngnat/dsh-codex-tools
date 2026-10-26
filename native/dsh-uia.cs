using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Imaging;
using System.Globalization;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Web.Script.Serialization;
using System.Windows.Automation;
using System.Windows.Forms;

/// <summary>Win32 entry points the helper needs for window identity, focus, and input.</summary>
static class NativeWin {
    public delegate bool EnumWindowsProc(IntPtr window, IntPtr state);

    [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc callback, IntPtr state);
    [DllImport("user32.dll")] public static extern bool IsWindow(IntPtr window);
    [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr window);
    [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr window);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowTextLength(IntPtr window);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowText(IntPtr window, StringBuilder text, int maxCount);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetClassName(IntPtr window, StringBuilder name, int maxCount);
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr window, out uint processId);
    [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll", SetLastError = true)] public static extern bool SetForegroundWindow(IntPtr window);
    [DllImport("user32.dll", SetLastError = true)] public static extern bool BringWindowToTop(IntPtr window);
    [DllImport("user32.dll", SetLastError = true)] public static extern bool ShowWindow(IntPtr window, int command);
    [DllImport("user32.dll")] public static extern IntPtr GetAncestor(IntPtr window, uint flags);
    [DllImport("user32.dll", SetLastError = true)] public static extern bool AttachThreadInput(uint attach, uint attachTo, bool doAttach);
    [DllImport("kernel32.dll")] public static extern uint GetCurrentThreadId();
    [DllImport("user32.dll")] public static extern IntPtr GetWindow(IntPtr window, uint command);
    [DllImport("user32.dll")] public static extern int GetWindowLong(IntPtr window, int index);
    [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
    [DllImport("user32.dll")] public static extern void mouse_event(int flags, int dx, int dy, int data, int extra);

    public const int LeftDown = 0x0002;
    public const int LeftUp = 0x0004;
    public const int Wheel = 0x0800;
    public const uint GetWindowOwner = 4;
    public const uint GetAncestorRoot = 2;
    public const int ExtendedStyleIndex = -20;
    public const int ExtendedStyleToolWindow = 0x00000080;
    public const int RestoreWindow = 9;
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

/// <summary>A failure a caller can act on: a stable code plus structured details.</summary>
sealed class ToolFailure : Exception {
    public readonly string Code;
    public readonly Dictionary<string, object> Details;

    public ToolFailure(string code, string message, Dictionary<string, object> details)
        : base(message) {
        Code = code;
        Details = details ?? new Dictionary<string, object>();
    }
}

/// <summary>One top-level window and the process that owns it.</summary>
sealed class WindowInfo {
    public IntPtr Hwnd;
    public int Pid;
    public string Title = "";
    public string ProcessName = "";
    public string ClassName = "";
    public int Session = -1;
    public bool Visible;
    public bool Minimized;
}

sealed class Program {
    static readonly JavaScriptSerializer Json = new JavaScriptSerializer();
    static readonly List<AutomationElement> Elements = new List<AutomationElement>();
    static readonly int SelfPid = Process.GetCurrentProcess().Id;
    static IntPtr treeOwner = IntPtr.Zero;
    const int MaxNodes = 500;

    [STAThread]
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
                Write(new Dictionary<string, object> { { "id", id }, { "ok", true }, { "result", Dispatch(op, args) } });
            } catch (Exception ex) {
                WriteFailure(id, ex);
            }
        }
    }

    // ---------------------------------------------------------------- protocol

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

    static string ArgText(Dictionary<string, object> args, string name) {
        var value = Arg(args, name);
        return value == null ? "" : (Convert.ToString(value) ?? "").Trim();
    }

    static int? ArgInt(Dictionary<string, object> args, string name) {
        var value = Arg(args, name);
        if (value == null || value is string && ((string)value).Length == 0) return null;
        return Convert.ToInt32(value);
    }

    /// <summary>Read pid/window_handle/title selectors. A handle may be decimal or 0x-prefixed.</summary>
    static long? ArgHandle(Dictionary<string, object> args, string name) {
        var raw = Arg(args, name);
        if (raw == null) return null;
        var text = (Convert.ToString(raw) ?? "").Trim();
        if (text.Length == 0) return null;
        if (text.StartsWith("0x", StringComparison.OrdinalIgnoreCase) || text.StartsWith("0X", StringComparison.OrdinalIgnoreCase)) {
            long hex;
            if (long.TryParse(text.Substring(2), NumberStyles.HexNumber, CultureInfo.InvariantCulture, out hex)) return hex;
            throw new ToolFailure("bad_window_handle", "window_handle \"" + text + "\" is not a hexadecimal window handle.", null);
        }
        long value;
        if (long.TryParse(text, NumberStyles.Integer, CultureInfo.InvariantCulture, out value)) return value;
        throw new ToolFailure("bad_window_handle", "window_handle \"" + text + "\" is neither a decimal number nor a 0x handle.", null);
    }

    static void Write(Dictionary<string, object> payload) {
        Console.Out.WriteLine(Json.Serialize(payload));
        Console.Out.Flush();
    }

    static void WriteFailure(object id, Exception ex) {
        var failure = ex as ToolFailure;
        if (failure == null && ex.InnerException != null) failure = ex.InnerException as ToolFailure;
        var payload = new Dictionary<string, object> { { "id", id }, { "ok", false } };
        if (failure != null) {
            payload["code"] = failure.Code;
            payload["error"] = failure.Message;
            if (failure.Details.Count > 0) payload["details"] = failure.Details;
        } else {
            var win32 = ex.GetBaseException() as Win32Exception;
            if (win32 != null) {
                payload["code"] = "win32_error";
                payload["win32"] = win32.NativeErrorCode;
                payload["error"] = "Windows error " + win32.NativeErrorCode + " (" + Win32Name(win32.NativeErrorCode) + "): " + win32.Message;
            } else {
                payload["code"] = "helper_error";
                payload["error"] = ex.GetBaseException().Message;
            }
        }
        Write(payload);
    }

    static Dictionary<string, object> Dispatch(string op, Dictionary<string, object> args) {
        switch (op) {
            case "list_apps": return ListApps();
            case "list_windows": return ListWindows(args);
            case "get_state": return GetState(args);
            case "click": return Click(args);
            case "type_text": return TypeText(args, "typed");
            case "paste": return TypeText(args, "pasted");
            case "press_key": return PressKey(args);
            case "scroll": return Scroll(args);
            case "drag": return Drag(args);
            case "set_value": return SetValue(args);
            case "select_text": return SelectText(args);
            case "perform_secondary_action": return Perform(args);
            case "screenshot": return Screenshot(args);
            default: throw new ToolFailure("unsupported_action", "unsupported action \"" + op + "\"", null);
        }
    }

    // ------------------------------------------------------------- win32 errors

    static string Win32Name(int code) {
        switch (code) {
            case 0: return "ERROR_SUCCESS";
            case 5: return "ERROR_ACCESS_DENIED";
            case 6: return "ERROR_INVALID_HANDLE";
            case 8: return "ERROR_NOT_ENOUGH_MEMORY";
            case 87: return "ERROR_INVALID_PARAMETER";
            case 1400: return "ERROR_INVALID_WINDOW_HANDLE";
            case 1421: return "ERROR_NO_ACCESS"; // control id not found on some builds
            case 1460: return "ERROR_TIMEOUT";
            default: return "win32";
        }
    }

    static string Win32Text(int code) {
        if (code == 0) return "";
        return " (Windows error " + code + " " + Win32Name(code) + ")";
    }

    // ------------------------------------------------------------ window lookup

    static string TitleOf(IntPtr hwnd) {
        var length = NativeWin.GetWindowTextLength(hwnd);
        if (length <= 0) return "";
        var buffer = new StringBuilder(length + 1);
        NativeWin.GetWindowText(hwnd, buffer, buffer.Capacity);
        return buffer.ToString();
    }

    static string ClassOf(IntPtr hwnd) {
        var buffer = new StringBuilder(256);
        NativeWin.GetClassName(hwnd, buffer, buffer.Capacity);
        return buffer.ToString();
    }

    static WindowInfo Describe(IntPtr hwnd) {
        if (hwnd == IntPtr.Zero || !NativeWin.IsWindow(hwnd)) return null;
        uint pid;
        NativeWin.GetWindowThreadProcessId(hwnd, out pid);
        if (pid == 0) return null;
        var info = new WindowInfo();
        info.Hwnd = hwnd;
        info.Pid = (int)pid;
        info.Title = TitleOf(hwnd);
        info.ClassName = ClassOf(hwnd);
        info.Visible = NativeWin.IsWindowVisible(hwnd);
        info.Minimized = NativeWin.IsIconic(hwnd);
        try {
            var proc = Process.GetProcessById(info.Pid);
            info.ProcessName = proc.ProcessName ?? "";
            try { info.Session = proc.SessionId; } catch (Exception) { info.Session = -1; }
        } catch (Exception) {
            info.ProcessName = "";
        }
        return info;
    }

    /// <summary>A real app window: visible, titled, and not an unowned tool helper.</summary>
    static bool IsAppWindow(WindowInfo info) {
        if (info == null || info.Pid == SelfPid) return false;
        if (!info.Visible || info.Title.Length == 0) return false;
        var owner = NativeWin.GetWindow(info.Hwnd, NativeWin.GetWindowOwner);
        var style = NativeWin.GetWindowLong(info.Hwnd, NativeWin.ExtendedStyleIndex);
        if (owner == IntPtr.Zero && (style & NativeWin.ExtendedStyleToolWindow) != 0) return false;
        return true;
    }

    static List<WindowInfo> VisibleWindows() {
        var found = new List<WindowInfo>();
        NativeWin.EnumWindows(delegate(IntPtr hwnd, IntPtr state) {
            var info = Describe(hwnd);
            if (IsAppWindow(info)) found.Add(info);
            return true;
        }, IntPtr.Zero);
        found.Sort(delegate(WindowInfo a, WindowInfo b) {
            var byPid = a.Pid.CompareTo(b.Pid);
            return byPid != 0 ? byPid : a.Hwnd.ToInt64().CompareTo(b.Hwnd.ToInt64());
        });
        return found;
    }

    static string HandleText(IntPtr hwnd) {
        return "0x" + hwnd.ToInt64().ToString("X8");
    }

    /// <summary>How a window identifies itself in every message.</summary>
    static string Id(WindowInfo window) {
        if (window == null) return "no window";
        return "pid=" + window.Pid + " hwnd=" + HandleText(window.Hwnd) + " \"" + window.Title + "\"";
    }

    /// <summary>Id plus the details that separate two same-named windows.</summary>
    static string Detail(WindowInfo window) {
        var process = window.ProcessName.Length == 0 ? "unknown process" : window.ProcessName;
        var session = window.Session >= 0 ? ", session " + window.Session : "";
        var state = window.Minimized ? ", minimized" : "";
        return Id(window) + " (" + process + session + state + ")";
    }

    /// <summary>
    /// A row is built from Win32 facts only. Probing every window with UI
    /// Automation would block the whole helper behind one hung app, and
    /// list_windows is the call a model uses to recover from a failure.
    /// </summary>
    static Dictionary<string, object> CandidateRow(WindowInfo window) {
        var row = new Dictionary<string, object> {
            { "pid", window.Pid },
            { "hwnd", window.Hwnd.ToInt64() },
            { "hwnd_hex", HandleText(window.Hwnd) },
            { "title", window.Title },
            { "process", window.ProcessName },
            { "session", window.Session },
            { "minimized", window.Minimized },
        };
        return row;
    }

    static List<Dictionary<string, object>> CandidateRows(List<WindowInfo> windows) {
        var rows = new List<Dictionary<string, object>>();
        foreach (var window in windows) rows.Add(CandidateRow(window));
        return rows;
    }

    static string CandidateLines(List<WindowInfo> windows) {
        var lines = new List<string>();
        foreach (var window in windows) lines.Add("  - " + Detail(window));
        return string.Join("\n", lines.ToArray());
    }

    /// <summary>Score one window against the caller's app name; 0 means no match.</summary>
    static int AppScore(WindowInfo window, string needle) {
        if (needle.Length == 0) return 0;
        var process = (window.ProcessName ?? "").ToLowerInvariant();
        var title = (window.Title ?? "").ToLowerInvariant();
        if (needle.IndexOf('\\') >= 0 || needle.IndexOf('/') >= 0) {
            var leaf = Path.GetFileNameWithoutExtension(needle).ToLowerInvariant();
            if (leaf.Length > 0 && process == leaf) return 40;
        }
        if (process.Length > 0 && process == needle) return 40;
        if (title == needle) return 40;
        if (process.Length > 0 && process.StartsWith(needle, StringComparison.Ordinal)) return 30;
        if (process.Length > 0 && process.Contains(needle)) return 20;
        if (title.Contains(needle)) return 10;
        return 0;
    }

    static List<WindowInfo> WindowsOfApp(string app) {
        var windows = VisibleWindows();
        if (app.Length == 0) return windows;
        var needle = app.ToLowerInvariant();
        var best = 0;
        var hits = new List<WindowInfo>();
        foreach (var window in windows) {
            var score = AppScore(window, needle);
            if (score <= 0) continue;
            if (score > best) {
                best = score;
                hits.Clear();
            }
            if (score == best) hits.Add(window);
        }
        return hits;
    }

    /// <summary>
    /// Pick exactly one window. A name that matches several windows is an error,
    /// never a silent first match: two Chrome windows can hold different pages.
    /// </summary>
    static WindowInfo WindowOf(Dictionary<string, object> args) {
        var app = ArgText(args, "app");
        var pid = ArgInt(args, "pid");
        var handle = ArgHandle(args, "window_handle");
        if (handle == null) handle = ArgHandle(args, "hwnd");
        var title = ArgText(args, "window_title");
        var hasSelector = pid != null || handle != null || title.Length > 0;

        if (app.Length == 0 && !hasSelector) {
            throw new ToolFailure("app_required",
                "app is required: name the app, or pass pid, window_handle or window_title. Call list_windows without app to see every window with its pid and handle.",
                null);
        }

        var matching = WindowsOfApp(app);
        if (app.Length > 0 && matching.Count == 0) {
            throw new ToolFailure("window_not_found",
                "no visible window matches app \"" + app + "\". Call list_windows without app to see every window with its pid and handle.",
                new Dictionary<string, object> { { "app", app }, { "windows", CandidateRows(VisibleWindows()) } });
        }
        if (matching.Count == 0) matching = VisibleWindows();

        var narrowed = new List<WindowInfo>();
        foreach (var window in matching) {
            if (pid != null && window.Pid != pid.Value) continue;
            if (handle != null && window.Hwnd.ToInt64() != handle.Value) continue;
            if (title.Length > 0 && window.Title.IndexOf(title, StringComparison.OrdinalIgnoreCase) < 0) continue;
            narrowed.Add(window);
        }

        if (narrowed.Count == 0) {
            var wanted = new List<string>();
            if (pid != null) wanted.Add("pid=" + pid.Value);
            if (handle != null) wanted.Add("window_handle=" + "0x" + handle.Value.ToString("X8"));
            if (title.Length > 0) wanted.Add("window_title=\"" + title + "\"");
            throw new ToolFailure("window_not_found",
                "no window of app \"" + (app.Length == 0 ? "*" : app) + "\" matches " + string.Join(" and ", wanted.ToArray()) + ". Its visible windows are:\n" + CandidateLines(matching),
                new Dictionary<string, object> { { "app", app }, { "windows", CandidateRows(matching) } });
        }

        var windowId = ArgInt(args, "window_id");
        if (narrowed.Count > 1) {
            if (windowId != null) {
                if (windowId.Value < 0 || windowId.Value >= narrowed.Count) {
                    throw new ToolFailure("window_id_out_of_range",
                        "window_id " + windowId.Value + " is out of range: " + narrowed.Count + " windows match. Candidates:\n" + CandidateLines(narrowed),
                        new Dictionary<string, object> { { "windows", CandidateRows(narrowed) } });
                }
                return narrowed[windowId.Value];
            }
            var details = new Dictionary<string, object> {
                { "app", app },
                { "windows", CandidateRows(narrowed) },
                { "selectors", new Dictionary<string, object> { { "pid", pid == null ? null : (object)pid.Value }, { "window_handle", handle == null ? null : (object)("0x" + handle.Value.ToString("X8")) }, { "window_title", title.Length == 0 ? null : (object)title } } },
            };
            throw new ToolFailure("ambiguous_window",
                "app \"" + (app.Length == 0 ? "*" : app) + "\" matches " + narrowed.Count + " windows; refusing to guess which one you mean. Pass pid, window_handle or window_title to choose:\n" + CandidateLines(narrowed),
                details);
        }
        return narrowed[0];
    }

    // ------------------------------------------------------------------ state

    /// <summary>
    /// Collect the control view below one element.
    /// @returns false when the tree stopped answering, so the caller can say so
    /// instead of losing the window identity to a bare exception.
    /// </summary>
    static bool Walk(AutomationElement element, int depth, List<string> lines) {
        if (element == null || depth > 16 || Elements.Count >= MaxNodes) return true;
        var index = Elements.Count;
        string role;
        string name;
        try {
            role = element.Current.ControlType.ProgrammaticName ?? "unknown";
            name = (element.Current.Name ?? "").Replace("\r", " ").Replace("\n", " ");
        } catch (Exception) {
            lines.Add(new string(' ', depth * 2) + "[stopped] an element stopped answering while its name was read. Call get_state again.");
            return false;
        }
        Elements.Add(element);
        lines.Add(new string(' ', depth * 2) + "[" + index + "] " + role + " " + name);
        var walker = TreeWalker.ControlViewWalker;
        AutomationElement child;
        try {
            child = walker.GetFirstChild(element);
        } catch (Exception) {
            lines.Add(new string(' ', depth * 2 + 2) + "[stopped] the children of [" + index + "] stopped answering.");
            return false;
        }
        while (child != null) {
            if (!Walk(child, depth + 1, lines)) return false;
            try {
                child = walker.GetNextSibling(child);
            } catch (Exception) {
                lines.Add(new string(' ', depth * 2 + 2) + "[stopped] the siblings of [" + index + "] stopped answering.");
                return false;
            }
        }
        return true;
    }

    static Dictionary<string, object> GetState(Dictionary<string, object> args) {
        var target = WindowOf(args);
        Elements.Clear();
        treeOwner = target.Hwnd;
        AutomationElement start;
        try {
            start = AutomationElement.FromHandle(target.Hwnd);
        } catch (Exception ex) {
            throw Unavailable(target, ex);
        }
        if (start == null) throw Unavailable(target, null);
        var lines = new List<string>();
        var complete = Walk(start, 0, lines);
        var header = "target: " + Detail(target) + (complete ? "" : " (tree truncated; see the [stopped] line)");
        return new Dictionary<string, object> {
            { "text", header + "\n" + string.Join("\n", lines.ToArray()) },
            { "count", Elements.Count },
            { "target", CandidateRow(target) },
        };
    }

    static ToolFailure Unavailable(WindowInfo target, Exception ex) {
        var message = "the window " + Id(target) + " did not answer UI Automation";
        if (ex != null) message += ": " + ex.GetBaseException().Message;
        message += ". It may have closed or hung; call list_windows again.";
        return new ToolFailure("window_unavailable", message, new Dictionary<string, object> { { "target", CandidateRow(target) } });
    }

    /// <summary>
    /// An element index is only meaningful for the window that produced the tree.
    /// Using it against another window is the exact failure that made clicks land
    /// in the wrong Chrome window, so it is reported instead of guessed.
    /// </summary>
    static AutomationElement ElementAt(Dictionary<string, object> args, WindowInfo target) {
        var index = Arg(args, "element_index");
        if (index == null) {
            throw new ToolFailure("element_index_required",
                "element_index is required: read get_state for " + Id(target) + " and use an index from that tree.",
                new Dictionary<string, object> { { "target", CandidateRow(target) } });
        }
        var i = Convert.ToInt32(index);
        var owner = Describe(treeOwner);
        // A window that closed after get_state must still fail loudly: the guard
        // exists for exactly that case, so a missing owner is a mismatch, not a pass.
        if (treeOwner != IntPtr.Zero && (owner == null || treeOwner != target.Hwnd)) {
            var source = owner == null
                ? "hwnd=" + HandleText(treeOwner) + ", which has since closed"
                : Detail(owner);
            var details = new Dictionary<string, object> { { "target", CandidateRow(target) } };
            if (owner != null) details["element_source"] = CandidateRow(owner);
            throw new ToolFailure("element_from_other_window",
                "element_index " + i + " came from " + source + ", but this call targets " + Id(target) + ". Run get_state for the window you mean, then use the indices from that tree.",
                details);
        }
        if (i < 0 || i >= Elements.Count) {
            throw new ToolFailure("stale_element",
                "element_index " + i + " is not in the latest get_state tree (" + Elements.Count + " elements on " + (owner == null ? "no window" : Id(owner)) + "). Read get_state again.",
                new Dictionary<string, object> { { "target", CandidateRow(target) } });
        }
        return Elements[i];
    }

    static object TryPattern(AutomationElement element, AutomationPattern pattern) {
        if (element == null) return null;
        object value;
        return element.TryGetCurrentPattern(pattern, out value) ? value : null;
    }

    // ------------------------------------------------------------------ focus

    static IntPtr Root(IntPtr hwnd) {
        var root = NativeWin.GetAncestor(hwnd, NativeWin.GetAncestorRoot);
        return root == IntPtr.Zero ? hwnd : root;
    }

    static bool IsForeground(IntPtr hwnd) {
        var foreground = NativeWin.GetForegroundWindow();
        if (foreground == IntPtr.Zero || hwnd == IntPtr.Zero) return false;
        return Root(foreground) == Root(hwnd);
    }

    static string ForegroundSentence() {
        var foreground = NativeWin.GetForegroundWindow();
        var info = Describe(foreground);
        return info == null ? "no window (the desktop may be locked or switching)" : Detail(info);
    }

    static Dictionary<string, object> ForegroundRow() {
        var info = Describe(NativeWin.GetForegroundWindow());
        return info == null ? new Dictionary<string, object>() : CandidateRow(info);
    }

    static Dictionary<string, object> FailureDetails(WindowInfo target, int code) {
        var details = new Dictionary<string, object> { { "target", CandidateRow(target) } };
        var foreground = Describe(NativeWin.GetForegroundWindow());
        if (foreground != null) details["foreground"] = CandidateRow(foreground);
        if (code != 0) details["win32"] = code;
        var session = -1;
        try { session = Process.GetCurrentProcess().SessionId; } catch (Exception) { }
        if (target.Session >= 0 && session >= 0) details["same_session"] = target.Session == session;
        return details;
    }

    /// <summary>Verify the target window really owns the keyboard before typing into it.</summary>
    static void EnsureForeground(WindowInfo target, string reason) {
        if (IsForeground(target.Hwnd)) return;
        if (target.Minimized) {
            NativeWin.ShowWindow(target.Hwnd, NativeWin.RestoreWindow);
            Thread.Sleep(150);
            var restored = Describe(target.Hwnd);
            if (restored != null) target.Minimized = restored.Minimized;
        }
        var code = 0;
        if (!NativeWin.SetForegroundWindow(target.Hwnd)) code = Marshal.GetLastWin32Error();
        Thread.Sleep(90);
        if (IsForeground(target.Hwnd)) return;

        var foreground = NativeWin.GetForegroundWindow();
        uint foregroundPid;
        var foregroundThread = NativeWin.GetWindowThreadProcessId(foreground, out foregroundPid);
        var self = NativeWin.GetCurrentThreadId();
        var attached = false;
        try {
            if (foregroundThread != 0 && foregroundThread != self) {
                attached = NativeWin.AttachThreadInput(self, foregroundThread, true);
            }
            NativeWin.BringWindowToTop(target.Hwnd);
            if (!NativeWin.SetForegroundWindow(target.Hwnd)) {
                var second = Marshal.GetLastWin32Error();
                if (second != 0) code = second;
            }
            Thread.Sleep(140);
        } finally {
            if (attached) NativeWin.AttachThreadInput(self, foregroundThread, false);
        }
        if (IsForeground(target.Hwnd)) return;

        var sameSession = true;
        try { sameSession = target.Session < 0 || target.Session == Process.GetCurrentProcess().SessionId; } catch (Exception) { }
        var hint = sameSession
            ? "Bring that window to the front yourself, or target a window that is already foreground."
            : "The window is in session " + target.Session + " while this helper runs in another session; computer_use cannot inject input across sessions.";
        throw new ToolFailure("foreground_denied",
            "could not focus " + Id(target) + " before " + reason + ": it is still not the foreground window" + Win32Text(code) +
            ". Foreground is currently " + ForegroundSentence() + ". " + hint,
            FailureDetails(target, code));
    }

    static void SendKeysTo(WindowInfo target, string keys, string reason) {
        if (keys.Length == 0) return;
        EnsureForeground(target, reason);
        try {
            SendKeys.SendWait(keys);
        } catch (Exception ex) {
            var win32 = ex.GetBaseException() as Win32Exception;
            var code = win32 == null ? 0 : win32.NativeErrorCode;
            throw new ToolFailure("input_denied",
                "sending keys to " + Id(target) + " failed even though the window was verified as foreground" +
                (code != 0 ? Win32Text(code) : "") + ": " + ex.GetBaseException().Message +
                ". Foreground is now " + ForegroundSentence() +
                ". Another window may have stolen focus; retry, or use set_value on a field that exposes UI Automation ValuePattern.",
                FailureDetails(target, code));
        }
    }

    // ------------------------------------------------------------------ input

    static void Mark(int x, int y) {
        AgentCursor.Show(x, y);
        NativeWin.SetCursorPos(x, y);
        Thread.Sleep(160);
    }

    static void MarkElement(AutomationElement element) {
        var rect = element.Current.BoundingRectangle;
        if (rect.Width <= 0 || rect.Height <= 0) return;
        Mark((int)(rect.X + rect.Width / 2), (int)(rect.Y + rect.Height / 2));
    }

    static void ClickPoint(int x, int y) {
        Mark(x, y);
        NativeWin.mouse_event(NativeWin.LeftDown, 0, 0, 0, 0);
        NativeWin.mouse_event(NativeWin.LeftUp, 0, 0, 0, 0);
    }

    static Rectangle WindowRect(WindowInfo target) {
        try {
            var element = AutomationElement.FromHandle(target.Hwnd);
            if (element == null) return Rectangle.Empty;
            var rect = element.Current.BoundingRectangle;
            return new Rectangle((int)rect.X, (int)rect.Y, (int)rect.Width, (int)rect.Height);
        } catch (Exception) {
            return Rectangle.Empty;
        }
    }

    static Dictionary<string, object> Result(WindowInfo target, string text, string method) {
        return new Dictionary<string, object> {
            { "text", text + " on " + Id(target) },
            { "method", method },
            { "target", CandidateRow(target) },
        };
    }

    /// <summary>
    /// True when the element sits inside the window whose element was passed in.
    /// This walks parents instead of comparing handles: UI Automation exposes
    /// NativeWindowHandle as a 32-bit int, which truncates real 64-bit handles.
    /// </summary>
    static bool BelongsTo(AutomationElement element, AutomationElement windowRoot) {
        if (element == null || windowRoot == null) return false;
        var walker = TreeWalker.ControlViewWalker;
        var current = element;
        for (var depth = 0; current != null && depth < 40; depth++) {
            try {
                if (current.Equals(windowRoot)) return true;
                current = walker.GetParent(current);
            } catch (Exception) {
                return false;
            }
        }
        return false;
    }

    /// <summary>
    /// The focused element, but only when it really lives in the target window.
    /// Two windows of one process (two Explorer windows, two Word documents) share
    /// a pid, so a pid check alone would type into the other window.
    /// </summary>
    static AutomationElement FocusedElement(WindowInfo target) {
        AutomationElement focused;
        try {
            focused = AutomationElement.FocusedElement;
        } catch (Exception) {
            return null;
        }
        if (focused == null) return null;
        try {
            if (focused.Current.ProcessId != target.Pid) return null;
        } catch (Exception) {
            return null;
        }
        AutomationElement windowRoot;
        try {
            windowRoot = AutomationElement.FromHandle(target.Hwnd);
        } catch (Exception) {
            return null;
        }
        return BelongsTo(focused, windowRoot) ? focused : null;
    }

    static void FocusElement(AutomationElement element, WindowInfo target, string reason) {
        if (element == null) return;
        EnsureForeground(target, reason);
        try {
            element.SetFocus();
        } catch (Exception) {
            var rect = element.Current.BoundingRectangle;
            if (rect.Width > 0 && rect.Height > 0) {
                ClickPoint((int)(rect.X + rect.Width / 2), (int)(rect.Y + rect.Height / 2));
            }
        }
        Thread.Sleep(60);
    }

    static Dictionary<string, object> Click(Dictionary<string, object> args) {
        var target = WindowOf(args);
        var index = Arg(args, "element_index");
        if (index != null) {
            var element = ElementAt(args, target);
            var label = "element " + Convert.ToInt32(index);
            var invoke = TryPattern(element, InvokePattern.Pattern) as InvokePattern;
            if (invoke != null) {
                try {
                    MarkElement(element);
                    invoke.Invoke();
                    return Result(target, "clicked " + label + " via InvokePattern", "invoke_pattern");
                } catch (Exception) { }
            }
            var toggle = TryPattern(element, TogglePattern.Pattern) as TogglePattern;
            if (toggle != null) {
                try {
                    MarkElement(element);
                    toggle.Toggle();
                    return Result(target, "clicked " + label + " via TogglePattern", "toggle_pattern");
                } catch (Exception) { }
            }
            // Raise the window first: restoring a minimized window moves every
            // rectangle, so a box read before that would click the wrong pixel.
            EnsureForeground(target, "clicking " + label);
            var rect = element.Current.BoundingRectangle;
            if (rect.Width <= 0 || rect.Height <= 0) {
                throw new ToolFailure("no_bounds",
                    label + " in " + Id(target) + " has no box to click and no InvokePattern. Read get_state again or click a parent element.",
                    new Dictionary<string, object> { { "target", CandidateRow(target) } });
            }
            var x = (int)(rect.X + rect.Width / 2);
            var y = (int)(rect.Y + rect.Height / 2);
            var windowRect = WindowRect(target);
            if (!windowRect.IsEmpty && !windowRect.Contains(x, y)) {
                throw new ToolFailure("element_outside_window",
                    label + " sits at " + x + "," + y + ", outside the box of " + Id(target) + " (" + windowRect.X + "," + windowRect.Y + " " + windowRect.Width + "x" + windowRect.Height + "). The tree probably came from another window; run get_state for this window.",
                    new Dictionary<string, object> { { "target", CandidateRow(target) } });
            }
            ClickPoint(x, y);
            return Result(target, "clicked " + label + " at " + x + "," + y, "mouse");
        }

        var px = Arg(args, "x");
        var py = Arg(args, "y");
        if (px == null || py == null) throw new ToolFailure("click_target_required", "click needs either element_index or both x and y", null);
        var pointX = Convert.ToInt32(px);
        var pointY = Convert.ToInt32(py);
        EnsureForeground(target, "clicking at " + pointX + "," + pointY);
        var box = WindowRect(target);
        if (!box.IsEmpty && !box.Contains(pointX, pointY)) {
            throw new ToolFailure("click_point_outside_window",
                "the point " + pointX + "," + pointY + " is outside " + Id(target) + " (" + box.X + "," + box.Y + " " + box.Width + "x" + box.Height + "). A pixel click can only land in the window you named; pass element_index, or name the window that actually holds that point.",
                new Dictionary<string, object> { { "target", CandidateRow(target) } });
        }
        ClickPoint(pointX, pointY);
        return Result(target, "clicked " + pointX + "," + pointY, "mouse");
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
        var target = WindowOf(args);
        var element = ElementAt(args, target);
        var index = Convert.ToInt32(Arg(args, "element_index"));
        var value = Convert.ToString(Arg(args, "value")) ?? "";
        var label = "element " + index;
        var pattern = TryPattern(element, ValuePattern.Pattern) as ValuePattern;
        if (pattern != null) {
            if (pattern.Current.IsReadOnly) {
                throw new ToolFailure("read_only",
                    label + " in " + Id(target) + " is read-only, so ValuePattern refused the new value. Nothing was typed.",
                    new Dictionary<string, object> { { "target", CandidateRow(target) } });
            }
            try {
                pattern.SetValue(value);
                return Result(target, "set " + label + " via ValuePattern (" + value.Length + " characters)", "value_pattern");
            } catch (Exception ex) {
                throw new ToolFailure("set_value_failed",
                    "ValuePattern.SetValue failed on " + label + " in " + Id(target) + ": " + ex.GetBaseException().Message + ". The field may have closed; read get_state again.",
                    new Dictionary<string, object> { { "target", CandidateRow(target) } });
            }
        }
        FocusElement(element, target, "replacing the text in " + label);
        SendKeysTo(target, "^a", "selecting the old text in " + label);
        SendKeysTo(target, EscapeSendKeys(value), "typing into " + label);
        return Result(target, "set " + label + " via keyboard because it has no ValuePattern", "keyboard");
    }

    static Dictionary<string, object> TypeText(Dictionary<string, object> args, string verb) {
        var target = WindowOf(args);
        var text = Convert.ToString(Arg(args, "text")) ?? "";
        var index = Arg(args, "element_index");
        AutomationElement element = index != null ? ElementAt(args, target) : FocusedElement(target);
        var where = index != null ? "element " + Convert.ToInt32(index) : "the focused element";

        if (text.Length > 0 && element != null) {
            var pattern = TryPattern(element, ValuePattern.Pattern) as ValuePattern;
            if (pattern != null && !pattern.Current.IsReadOnly) {
                try {
                    var existing = pattern.Current.Value ?? "";
                    pattern.SetValue(existing + text);
                    return Result(target, verb + " " + text.Length + " characters into " + where + " via ValuePattern", "value_pattern");
                } catch (Exception) { }
            }
        }
        if (element != null) FocusElement(element, target, verb + " into " + where + " on " + Id(target));
        EnsureForeground(target, verb + " into " + Id(target));
        SendKeysTo(target, EscapeSendKeys(text), verb + " into " + where);
        return Result(target, verb + " " + text.Length + " characters into " + where + " via keyboard", "keyboard");
    }

    static Dictionary<string, object> PressKey(Dictionary<string, object> args) {
        var target = WindowOf(args);
        var raw = (Convert.ToString(Arg(args, "key")) ?? "").ToLowerInvariant();
        var parts = raw.Split(new[] { '+' }, StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length == 0) throw new ToolFailure("key_required", "key is required, for example Return or ctrl+c", null);
        var prefix = "";
        for (var i = 0; i < parts.Length - 1; i++) {
            switch (parts[i]) {
                case "ctrl":
                case "control": prefix += "^"; break;
                case "shift": prefix += "+"; break;
                case "alt":
                case "option": prefix += "%"; break;
                default: throw new ToolFailure("unsupported_key", "unsupported key \"" + raw + "\": use ctrl, shift or alt as modifiers", null);
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
                if (key.Length != 1) throw new ToolFailure("unsupported_key", "unsupported key \"" + raw + "\": single characters and Return/Tab/Escape/Space/Delete/Backspace/arrows are supported", null);
                body = EscapeSendKeys(key);
                break;
        }
        SendKeysTo(target, prefix + body, "pressing " + raw);
        return Result(target, "pressed " + raw, "keyboard");
    }

    static Dictionary<string, object> Scroll(Dictionary<string, object> args) {
        var target = WindowOf(args);
        var direction = (Convert.ToString(Arg(args, "direction")) ?? "down").ToLowerInvariant();
        var pages = ArgInt(args, "pages") ?? 1;
        if (pages < 1) pages = 1;
        var index = Arg(args, "element_index");
        if (index != null) {
            var element = ElementAt(args, target);
            EnsureForeground(target, "scrolling element " + Convert.ToInt32(index));
            // Read the box only after the window is where it will stay.
            var rect = element.Current.BoundingRectangle;
            if (rect.Width <= 0 || rect.Height <= 0) {
                throw new ToolFailure("no_bounds",
                    "element " + Convert.ToInt32(index) + " in " + Id(target) + " has no box to scroll over.",
                    new Dictionary<string, object> { { "target", CandidateRow(target) } });
            }
            ClickPoint((int)(rect.X + rect.Width / 2), (int)(rect.Y + rect.Height / 2));
        } else {
            EnsureForeground(target, "scrolling " + Id(target));
        }
        var delta = pages * 120;
        int amount;
        switch (direction) {
            case "up":
            case "u": amount = delta; break;
            case "down":
            case "d": amount = -delta; break;
            default: throw new ToolFailure("unsupported_scroll", "unsupported scroll direction \"" + direction + "\": use up or down", null);
        }
        try {
            NativeWin.mouse_event(NativeWin.Wheel, 0, 0, amount, 0);
        } catch (Exception ex) {
            var win32 = ex.GetBaseException() as Win32Exception;
            var code = win32 == null ? 0 : win32.NativeErrorCode;
            throw new ToolFailure("scroll_denied", "scrolling " + Id(target) + " failed" + Win32Text(code) + ": " + ex.GetBaseException().Message, FailureDetails(target, code));
        }
        return Result(target, "scrolled " + direction + " " + pages + " page(s)", "mouse");
    }

    static Dictionary<string, object> Drag(Dictionary<string, object> args) {
        var target = WindowOf(args);
        foreach (var name in new[] { "from_x", "from_y", "to_x", "to_y" }) {
            if (Arg(args, name) == null) throw new ToolFailure("drag_target_required", "drag needs from_x, from_y, to_x and to_y", null);
        }
        var x1 = Convert.ToInt32(Arg(args, "from_x"));
        var y1 = Convert.ToInt32(Arg(args, "from_y"));
        var x2 = Convert.ToInt32(Arg(args, "to_x"));
        var y2 = Convert.ToInt32(Arg(args, "to_y"));
        EnsureForeground(target, "dragging inside " + Id(target));
        Mark(x1, y1);
        NativeWin.mouse_event(NativeWin.LeftDown, 0, 0, 0, 0);
        Mark(x2, y2);
        NativeWin.mouse_event(NativeWin.LeftUp, 0, 0, 0, 0);
        return Result(target, "dragged " + x1 + "," + y1 + " to " + x2 + "," + y2, "mouse");
    }

    static Dictionary<string, object> SelectText(Dictionary<string, object> args) {
        var target = WindowOf(args);
        var element = ElementAt(args, target);
        var index = Convert.ToInt32(Arg(args, "element_index"));
        var text = Convert.ToString(Arg(args, "text")) ?? "";
        var pattern = TryPattern(element, TextPattern.Pattern) as TextPattern;
        if (pattern == null) {
            throw new ToolFailure("select_text_unsupported",
                "element " + index + " in " + Id(target) + " exposes no TextPattern, so its text cannot be selected. Target the editable field instead.",
                new Dictionary<string, object> { { "target", CandidateRow(target) } });
        }
        var range = pattern.DocumentRange.FindText(text, false, false);
        if (range == null) {
            throw new ToolFailure("text_not_found",
                "the text was not found in element " + index + " of " + Id(target) + ". Nothing was selected.",
                new Dictionary<string, object> { { "target", CandidateRow(target) } });
        }
        range.Select();
        return Result(target, "selected text in element " + index, "text_pattern");
    }

    static Dictionary<string, object> Perform(Dictionary<string, object> args) {
        var target = WindowOf(args);
        var element = ElementAt(args, target);
        var index = Convert.ToInt32(Arg(args, "element_index"));
        var name = Convert.ToString(Arg(args, "action_name"));
        if (string.IsNullOrWhiteSpace(name)) name = "Invoke";
        switch (name.ToLowerInvariant()) {
            case "invoke":
            case "press":
                var invoke = TryPattern(element, InvokePattern.Pattern) as InvokePattern;
                if (invoke == null) throw Unsupported(target, name, index);
                invoke.Invoke();
                break;
            case "toggle":
                var toggle = TryPattern(element, TogglePattern.Pattern) as TogglePattern;
                if (toggle == null) throw Unsupported(target, name, index);
                toggle.Toggle();
                break;
            case "expand":
                var expand = TryPattern(element, ExpandCollapsePattern.Pattern) as ExpandCollapsePattern;
                if (expand == null) throw Unsupported(target, name, index);
                expand.Expand();
                break;
            case "collapse":
                var collapse = TryPattern(element, ExpandCollapsePattern.Pattern) as ExpandCollapsePattern;
                if (collapse == null) throw Unsupported(target, name, index);
                collapse.Collapse();
                break;
            default:
                throw new ToolFailure("unsupported_action_name",
                    "unsupported accessibility action \"" + name + "\": use invoke, toggle, expand or collapse.",
                    new Dictionary<string, object> { { "target", CandidateRow(target) } });
        }
        return Result(target, "performed " + name + " on element " + index, "pattern");
    }

    static ToolFailure Unsupported(WindowInfo target, string name, int index) {
        return new ToolFailure("action_unsupported",
            "element " + index + " in " + Id(target) + " does not expose the " + name + " pattern. Read get_state again and pick an element that offers it.",
            new Dictionary<string, object> { { "target", CandidateRow(target) } });
    }

    static Dictionary<string, object> Screenshot(Dictionary<string, object> args) {
        var target = WindowOf(args);
        if (target.Minimized) {
            throw new ToolFailure("window_minimized",
                Id(target) + " is minimized, so its pixels are not on screen. Restore it first (an action that raises it will do that).",
                new Dictionary<string, object> { { "target", CandidateRow(target) } });
        }
        var rect = WindowRect(target);
        if (rect.Width <= 0 || rect.Height <= 0) {
            throw new ToolFailure("no_bounds", Id(target) + " has no visible box to capture.", new Dictionary<string, object> { { "target", CandidateRow(target) } });
        }
        using (var bitmap = new Bitmap(rect.Width, rect.Height))
        using (var graphics = Graphics.FromImage(bitmap)) {
            graphics.CopyFromScreen(rect.X, rect.Y, 0, 0, new Size(rect.Width, rect.Height));
            var path = Path.Combine(Path.GetTempPath(), "dsh-uia-" + DateTime.UtcNow.Ticks + ".png");
            bitmap.Save(path, ImageFormat.Png);
            return new Dictionary<string, object> {
                { "text", "screenshot of " + Id(target) + " saved to " + path },
                { "path", path },
                { "target", CandidateRow(target) },
            };
        }
    }

    // --------------------------------------------------------------- inventory

    static Dictionary<string, object> ListApps() {
        var windows = VisibleWindows();
        var order = new List<int>();
        var byPid = new Dictionary<int, List<WindowInfo>>();
        foreach (var window in windows) {
            if (!byPid.ContainsKey(window.Pid)) {
                byPid[window.Pid] = new List<WindowInfo>();
                order.Add(window.Pid);
            }
            byPid[window.Pid].Add(window);
        }
        var apps = new List<Dictionary<string, object>>();
        var lines = new List<string>();
        foreach (var pid in order) {
            var list = byPid[pid];
            var first = list[0];
            apps.Add(new Dictionary<string, object> {
                { "name", first.ProcessName },
                { "pid", pid },
                { "title", first.Title },
                { "hwnd", first.Hwnd.ToInt64() },
                { "hwnd_hex", HandleText(first.Hwnd) },
                { "session", first.Session },
                { "windows", list.Count },
            });
            lines.Add(pid + "\t" + first.ProcessName + "\t" + list.Count + " window(s)\t" + first.Title);
        }
        return new Dictionary<string, object> { { "text", string.Join("\n", lines.ToArray()) }, { "apps", apps } };
    }

    static Dictionary<string, object> ListWindows(Dictionary<string, object> args) {
        var app = ArgText(args, "app");
        var rows = WindowsOfApp(app);
        var windows = new List<Dictionary<string, object>>();
        var lines = new List<string>();
        for (var i = 0; i < rows.Count; i++) {
            var row = CandidateRow(rows[i]);
            row["index"] = i;
            windows.Add(row);
            lines.Add(i + "\t" + Detail(rows[i]));
        }
        string text;
        if (rows.Count > 0) text = string.Join("\n", lines.ToArray());
        else if (app.Length == 0) text = "No windows.";
        else text = "No visible window matches app \"" + app + "\". Call list_windows without app to see every window with its pid and handle.";
        if (rows.Count > 1 && app.Length > 0) {
            text += "\n" + rows.Count + " windows match; every action must name one with pid, window_handle or window_title.";
        }
        return new Dictionary<string, object> { { "text", text }, { "windows", windows }, { "app", app } };
    }
}
