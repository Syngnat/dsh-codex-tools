import AppKit
import ApplicationServices
import CoreGraphics
import Foundation

/// Native macOS computer-use backend. One JSON object per stdin line, one JSON
/// object per stdout line. No Codex, ChatGPT, or Sky process is involved.
struct AxError: Error, CustomStringConvertible {
    let description: String
}

final class Session {
    var elements: [AXUIElement] = []
    let maxNodes = 500
}

let session = Session()

func emit(_ object: [String: Any]) {
    guard let data = try? JSONSerialization.data(withJSONObject: object),
          var text = String(data: data, encoding: .utf8) else { return }
    text.append("\n")
    FileHandle.standardOutput.write(Data(text.utf8))
}

func intValue(_ any: Any?) -> Int? {
    if let number = any as? Int { return number }
    if let number = any as? NSNumber { return number.intValue }
    if let text = any as? String { return Int(text) }
    return nil
}

func doubleValue(_ any: Any?) -> Double? {
    if let number = any as? Double { return number }
    if let number = any as? NSNumber { return number.doubleValue }
    if let text = any as? String { return Double(text) }
    return nil
}

func ensureTrusted() throws {
    let key = kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String
    let options = [key: false] as CFDictionary
    if !AXIsProcessTrustedWithOptions(options) {
        _ = AXIsProcessTrustedWithOptions([key: true] as CFDictionary)
        throw AxError(description: "dsh-ax has no Accessibility permission. Enable bin/dsh-ax in System Settings → Privacy & Security → Accessibility, then retry.")
    }
}

func findApp(_ name: String) throws -> NSRunningApplication {
    let apps = NSWorkspace.shared.runningApplications
    if let exact = apps.first(where: { $0.localizedName == name || $0.bundleIdentifier == name }) {
        return exact
    }
    let needle = name.lowercased()
    if let fuzzy = apps.first(where: { ($0.localizedName ?? "").lowercased().contains(needle) }) {
        return fuzzy
    }
    throw AxError(description: "no running app matches \"\(name)\"")
}

func attr(_ element: AXUIElement, _ name: String) -> CFTypeRef? {
    var value: CFTypeRef?
    guard AXUIElementCopyAttributeValue(element, name as CFString, &value) == .success else { return nil }
    return value
}

func attrString(_ element: AXUIElement, _ name: String) -> String? {
    attr(element, name) as? String
}

func walk(_ element: AXUIElement, depth: Int, lines: inout [String]) {
    if session.elements.count >= session.maxNodes || depth > 16 { return }
    let index = session.elements.count
    session.elements.append(element)
    let role = attrString(element, kAXRoleAttribute) ?? "AXUnknown"
    let title = attrString(element, kAXTitleAttribute)
        ?? attrString(element, kAXDescriptionAttribute)
        ?? attrString(element, kAXValueAttribute)
        ?? ""
    let trimmed = title.replacingOccurrences(of: "\n", with: " ")
    lines.append("\(String(repeating: "  ", count: depth))[\(index)] \(role) \(trimmed)")
    let children = attr(element, kAXChildrenAttribute) as? [AXUIElement] ?? []
    for child in children {
        walk(child, depth: depth + 1, lines: &lines)
    }
}

func element(_ args: [String: Any]) throws -> AXUIElement {
    guard let index = intValue(args["element_index"]) else {
        throw AxError(description: "element_index is required")
    }
    guard index >= 0, index < session.elements.count else {
        throw AxError(description: "element_index \(index) is not in the last get_state tree. Read get_state again.")
    }
    return session.elements[index]
}

func listApps() -> [String: Any] {
    let apps = NSWorkspace.shared.runningApplications
        .filter { $0.activationPolicy == .regular }
        .map { app -> [String: Any] in
            [
                "name": app.localizedName ?? "",
                "bundleId": app.bundleIdentifier ?? "",
                "pid": Int(app.processIdentifier),
            ]
        }
    let text = apps.map { "\($0["pid"] ?? "")\t\($0["name"] ?? "")\t\($0["bundleId"] ?? "")" }.joined(separator: "\n")
    return ["text": text, "apps": apps]
}

func listWindows(_ args: [String: Any]) throws -> [String: Any] {
    let app = try findApp(args["app"] as? String ?? "")
    let ax = AXUIElementCreateApplication(app.processIdentifier)
    let windows = attr(ax, kAXWindowsAttribute) as? [AXUIElement] ?? []
    let rows: [[String: Any]] = windows.enumerated().map { offset, window in
        ["index": offset, "title": attrString(window, kAXTitleAttribute) ?? ""]
    }
    let text = rows.map { "\($0["index"] ?? "")\t\($0["title"] ?? "")" }.joined(separator: "\n")
    return ["text": text.isEmpty ? "No windows." : text, "windows": rows]
}

func getState(_ args: [String: Any]) throws -> [String: Any] {
    let app = try findApp(args["app"] as? String ?? "")
    session.elements.removeAll(keepingCapacity: true)
    let ax = AXUIElementCreateApplication(app.processIdentifier)
    var root = ax
    if let wanted = intValue(args["window_id"]) {
        let windows = attr(ax, kAXWindowsAttribute) as? [AXUIElement] ?? []
        guard wanted >= 0, wanted < windows.count else {
            throw AxError(description: "window_id \(wanted) is out of range")
        }
        root = windows[wanted]
    }
    var lines: [String] = []
    walk(root, depth: 0, lines: &lines)
    return ["text": lines.joined(separator: "\n"), "count": session.elements.count]
}

func center(of element: AXUIElement) -> CGPoint? {
    guard let position = attr(element, kAXPositionAttribute),
          let size = attr(element, kAXSizeAttribute) else { return nil }
    var point = CGPoint.zero
    var box = CGSize.zero
    guard AXValueGetValue(position as! AXValue, .cgPoint, &point),
          AXValueGetValue(size as! AXValue, .cgSize, &box) else { return nil }
    return CGPoint(x: point.x + box.width / 2, y: point.y + box.height / 2)
}

func clickPoint(_ point: CGPoint) {
    let source = CGEventSource(stateID: .hidSystemState)
    let down = CGEvent(mouseEventSource: source, mouseType: .leftMouseDown, mouseCursorPosition: point, mouseButton: .left)
    let up = CGEvent(mouseEventSource: source, mouseType: .leftMouseUp, mouseCursorPosition: point, mouseButton: .left)
    down?.post(tap: .cghidEventTap)
    up?.post(tap: .cghidEventTap)
}

func click(_ args: [String: Any]) throws -> [String: Any] {
    if intValue(args["element_index"]) != nil {
        let target = try element(args)
        let result = AXUIElementPerformAction(target, kAXPressAction as CFString)
        if result != .success, let point = center(of: target) {
            clickPoint(point)
        }
        return ["text": "clicked \(intValue(args["element_index"]) ?? -1)"]
    }
    guard let x = doubleValue(args["x"]), let y = doubleValue(args["y"]) else {
        throw AxError(description: "click needs either `element_index` or both `x` and `y`")
    }
    clickPoint(CGPoint(x: x, y: y))
    return ["text": "clicked \(x), \(y)"]
}

func postText(_ text: String) throws {
    let source = CGEventSource(stateID: .hidSystemState)
    let units = Array(text.utf16)
    guard !units.isEmpty,
          let down = CGEvent(keyboardEventSource: source, virtualKey: 0, keyDown: true),
          let up = CGEvent(keyboardEventSource: source, virtualKey: 0, keyDown: false) else {
        throw AxError(description: "cannot create a keyboard event")
    }
    units.withUnsafeBufferPointer { buffer in
        guard let base = buffer.baseAddress else { return }
        down.keyboardSetUnicodeString(stringLength: units.count, unicodeString: base)
        up.keyboardSetUnicodeString(stringLength: units.count, unicodeString: base)
    }
    down.post(tap: .cghidEventTap)
    up.post(tap: .cghidEventTap)
}

func setValue(_ args: [String: Any]) throws -> [String: Any] {
    let target = try element(args)
    let value = args["value"] as? String ?? ""
    let result = AXUIElementSetAttributeValue(target, kAXValueAttribute as CFString, value as CFTypeRef)
    if result != .success {
        AXUIElementPerformAction(target, kAXPressAction as CFString)
        try postText(value)
    }
    return ["text": "set value"]
}

func typeText(_ args: [String: Any]) throws -> [String: Any] {
    if intValue(args["element_index"]) != nil {
        _ = try setValue(args)
    }
    try postText(args["text"] as? String ?? "")
    return ["text": "typed"]
}

let keyCodes: [String: CGKeyCode] = [
    "return": 36, "enter": 36, "tab": 48, "escape": 53, "esc": 53, "space": 49,
    "delete": 51, "backspace": 51, "up": 126, "down": 125, "left": 123, "right": 124,
    "a": 0, "c": 8, "v": 9, "x": 7, "z": 6,
]

func pressKey(_ args: [String: Any]) throws -> [String: Any] {
    let raw = (args["key"] as? String ?? "").lowercased()
    let parts = raw.split(separator: "+").map(String.init)
    var flags: CGEventFlags = []
    let key = parts.last ?? ""
    for part in parts.dropLast() {
        switch part {
        case "super", "cmd", "command", "meta": flags.insert(.maskCommand)
        case "shift": flags.insert(.maskShift)
        case "alt", "option": flags.insert(.maskAlternate)
        case "ctrl", "control": flags.insert(.maskControl)
        default: break
        }
    }
    guard let code = keyCodes[key] else {
        throw AxError(description: "unsupported key \"\(raw)\"")
    }
    let source = CGEventSource(stateID: .hidSystemState)
    let down = CGEvent(keyboardEventSource: source, virtualKey: code, keyDown: true)
    let up = CGEvent(keyboardEventSource: source, virtualKey: code, keyDown: false)
    down?.flags = flags
    up?.flags = flags
    down?.post(tap: .cghidEventTap)
    up?.post(tap: .cghidEventTap)
    return ["text": "pressed \(raw)"]
}

func scroll(_ args: [String: Any]) throws -> [String: Any] {
    let direction = (args["direction"] as? String ?? "down").lowercased()
    let pages = intValue(args["pages"]) ?? 1
    let amount = Int32(max(1, pages) * 3)
    let vertical: Int32
    let horizontal: Int32
    switch direction {
    case "up", "u": vertical = amount; horizontal = 0
    case "down", "d": vertical = -amount; horizontal = 0
    case "left", "l": vertical = 0; horizontal = amount
    case "right", "r": vertical = 0; horizontal = -amount
    default: throw AxError(description: "unsupported scroll direction \"\(direction)\"")
    }
    if intValue(args["element_index"]) != nil, let point = center(of: try element(args)) {
        clickPoint(point)
    }
    let event = CGEvent(scrollWheelEvent2Source: nil, units: .line, wheelCount: 2, wheel1: vertical, wheel2: horizontal, wheel3: 0)
    event?.post(tap: .cghidEventTap)
    return ["text": "scrolled \(direction)"]
}

func screenshot(_ args: [String: Any]) throws -> [String: Any] {
    let app = try findApp(args["app"] as? String ?? "")
    guard let info = CGWindowListCopyWindowInfo([.optionOnScreenOnly, .excludeDesktopElements], kCGNullWindowID) as? [[String: Any]] else {
        throw AxError(description: "cannot list windows for a screenshot")
    }
    let pid = Int(app.processIdentifier)
    let window = info.first { row in
        (row[kCGWindowOwnerPID as String] as? Int) == pid && ((row[kCGWindowLayer as String] as? Int) ?? 0) == 0
    }
    guard let number = window?[kCGWindowNumber as String] as? CGWindowID else {
        throw AxError(description: "no on-screen window to capture. Grant Screen Recording to bin/dsh-ax if a window is visible.")
    }
    let path = NSTemporaryDirectory() + "dsh-ax-\(Int(Date().timeIntervalSince1970 * 1000)).png"
    let task = Process()
    task.executableURL = URL(fileURLWithPath: "/usr/sbin/screencapture")
    task.arguments = ["-x", "-l", String(number), path]
    try task.run()
    task.waitUntilExit()
    if task.terminationStatus != 0 || !FileManager.default.fileExists(atPath: path) {
        throw AxError(description: "screenshot failed. Grant Screen Recording permission to bin/dsh-ax.")
    }
    return ["text": "screenshot saved to \(path)", "path": path]
}

func perform(_ args: [String: Any]) throws -> [String: Any] {
    let target = try element(args)
    let name = args["action_name"] as? String ?? kAXPressAction
    let result = AXUIElementPerformAction(target, name as CFString)
    if result != .success {
        throw AxError(description: "accessibility action \(name) failed (\(result.rawValue))")
    }
    return ["text": "performed \(name)"]
}

func selectText(_ args: [String: Any]) throws -> [String: Any] {
    let target = try element(args)
    let text = args["text"] as? String ?? ""
    let result = AXUIElementSetAttributeValue(target, kAXSelectedTextAttribute as CFString, text as CFTypeRef)
    if result != .success {
        throw AxError(description: "select_text failed (\(result.rawValue))")
    }
    return ["text": "selected text"]
}

func drag(_ args: [String: Any]) throws -> [String: Any] {
    guard let x1 = doubleValue(args["from_x"]), let y1 = doubleValue(args["from_y"]),
          let x2 = doubleValue(args["to_x"]), let y2 = doubleValue(args["to_y"]) else {
        throw AxError(description: "drag needs from_x, from_y, to_x and to_y")
    }
    let source = CGEventSource(stateID: .hidSystemState)
    let from = CGPoint(x: x1, y: y1)
    let to = CGPoint(x: x2, y: y2)
    CGEvent(mouseEventSource: source, mouseType: .leftMouseDown, mouseCursorPosition: from, mouseButton: .left)?.post(tap: .cghidEventTap)
    CGEvent(mouseEventSource: source, mouseType: .leftMouseDragged, mouseCursorPosition: to, mouseButton: .left)?.post(tap: .cghidEventTap)
    CGEvent(mouseEventSource: source, mouseType: .leftMouseUp, mouseCursorPosition: to, mouseButton: .left)?.post(tap: .cghidEventTap)
    return ["text": "dragged"]
}

func handle(_ op: String, _ args: [String: Any]) throws -> [String: Any] {
    switch op {
    case "list_apps": return listApps()
    case "list_windows": return try listWindows(args)
    case "get_state": return try getState(args)
    case "click": return try click(args)
    case "type_text": return try typeText(args)
    case "paste": return try typeText(args)
    case "press_key": return try pressKey(args)
    case "scroll": return try scroll(args)
    case "drag": return try drag(args)
    case "set_value": return try setValue(args)
    case "select_text": return try selectText(args)
    case "perform_secondary_action": return try perform(args)
    case "screenshot": return try screenshot(args)
    default: throw AxError(description: "unsupported action \"\(op)\"")
    }
}

while let line = readLine(strippingNewline: true) {
    guard let data = line.data(using: .utf8),
          let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { continue }
    let id = object["id"] ?? 0
    let op = object["op"] as? String ?? ""
    let args = object["args"] as? [String: Any] ?? [:]
    do {
        try ensureTrusted()
        emit(["id": id, "ok": true, "result": try handle(op, args)])
    } catch {
        let message = (error as? AxError)?.description ?? error.localizedDescription
        emit(["id": id, "ok": false, "error": message])
    }
}
