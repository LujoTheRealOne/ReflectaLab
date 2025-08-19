import Foundation
import UIKit
import React

@objc(NativeRichTextEditor)
class NativeRichTextEditor: UIView, UITextViewDelegate, UIGestureRecognizerDelegate {
  // Event sent to JS on text changes
  @objc var onChange: RCTBubblingEventBlock?

  private var toolbarBottomConstraint: NSLayoutConstraint?
  private var keyboardVisible: Bool = false
  private var lastKeyboardOverlap: CGFloat = 0

  // Additional inset from JS to account for app overlays above the keyboard
  @objc var additionalBottomInset: NSNumber? {
    didSet {
      updateToolbarBottomConstraint(animated: true)
    }
  }

  private let toolbarContainer: UIView = {
    let view = UIView(frame: .zero)
    view.translatesAutoresizingMaskIntoConstraints = false
    view.backgroundColor = .systemBackground
    return view
  }()

  private let toolbarTopBorder: UIView = {
    let view = UIView(frame: .zero)
    view.translatesAutoresizingMaskIntoConstraints = false
    view.backgroundColor = .separator
    return view
  }()

  private let toolbar: UIStackView = {
    let stack = UIStackView(frame: .zero)
    stack.axis = .horizontal
    stack.alignment = .fill
    stack.distribution = .fillEqually
    stack.spacing = 8
    stack.translatesAutoresizingMaskIntoConstraints = false
    return stack
  }()

  // Keep references to formatting buttons so we can update their visual state
  private var boldButton: UIButton!
  private var italicButton: UIButton!
  private var underlineButton: UIButton!

  private let textView: UITextView = {
    let tv = UITextView(frame: .zero)
    tv.isScrollEnabled = true
    tv.backgroundColor = .clear
    tv.textContainerInset = .zero
    tv.textContainer.lineFragmentPadding = 0
    tv.autocorrectionType = .yes
    tv.autocapitalizationType = .sentences
    tv.keyboardDismissMode = .interactive
    tv.font = UIFont.preferredFont(forTextStyle: .body)
    tv.adjustsFontForContentSizeCategory = true
    tv.translatesAutoresizingMaskIntoConstraints = false
    tv.isEditable = true
    tv.isSelectable = true
    return tv
  }()

  override init(frame: CGRect) {
    super.init(frame: frame)
    print("🚀 NativeRichTextEditor initialized!")
    setup()
  }

  required init?(coder: NSCoder) {
    super.init(coder: coder)
    setup()
  }

  private func setup() {
    backgroundColor = .clear
    addSubview(textView)
    addSubview(toolbarContainer)
    toolbarContainer.addSubview(toolbar)
    toolbarContainer.addSubview(toolbarTopBorder)

    // Build toolbar buttons
    boldButton = createToolbarButton(title: "B", action: #selector(handleBoldTapped))
    italicButton = createToolbarButton(title: "/", action: #selector(handleItalicTapped))
    underlineButton = createToolbarButton(title: "U", action: #selector(handleUnderlineTapped))
    let bulletButton = createToolbarButton(title: "•", action: #selector(handleBulletTapped))
    let checkboxButton = createToolbarButton(title: "☐", action: #selector(handleCheckboxTapped))

    [boldButton!, italicButton!, underlineButton!, bulletButton, checkboxButton].forEach { toolbar.addArrangedSubview($0) }

    // Create bottom constraint reference so we can raise toolbar over keyboard
    let bottom = toolbarContainer.bottomAnchor.constraint(equalTo: bottomAnchor)
    toolbarBottomConstraint = bottom

    NSLayoutConstraint.activate([
      // Text view fills above toolbar
      textView.topAnchor.constraint(equalTo: topAnchor),
      textView.leadingAnchor.constraint(equalTo: leadingAnchor),
      textView.trailingAnchor.constraint(equalTo: trailingAnchor),
      textView.bottomAnchor.constraint(equalTo: toolbarContainer.topAnchor),

      // Toolbar container pinned to bottom
      toolbarContainer.leadingAnchor.constraint(equalTo: leadingAnchor),
      toolbarContainer.trailingAnchor.constraint(equalTo: trailingAnchor),
      bottom,
      toolbarContainer.heightAnchor.constraint(equalToConstant: 48),

      // Toolbar stack inside container with horizontal padding
      toolbar.leadingAnchor.constraint(equalTo: toolbarContainer.leadingAnchor, constant: 12),
      toolbar.trailingAnchor.constraint(equalTo: toolbarContainer.trailingAnchor, constant: -12),
      toolbar.centerYAnchor.constraint(equalTo: toolbarContainer.centerYAnchor),
      toolbar.heightAnchor.constraint(equalToConstant: 32),

      // Hairline top border
      toolbarTopBorder.topAnchor.constraint(equalTo: toolbarContainer.topAnchor),
      toolbarTopBorder.leadingAnchor.constraint(equalTo: toolbarContainer.leadingAnchor),
      toolbarTopBorder.trailingAnchor.constraint(equalTo: toolbarContainer.trailingAnchor),
      toolbarTopBorder.heightAnchor.constraint(equalToConstant: 1.0 / UIScreen.main.scale)
    ])
    textView.delegate = self

    // Add tap gesture recognizer for checkbox interaction
    let tapGesture = UITapGestureRecognizer(target: self, action: #selector(handleTextViewTap(_:)))
    tapGesture.delegate = self
    textView.addGestureRecognizer(tapGesture)

    // Default typing attributes
    textView.typingAttributes = defaultTypingAttributes()

    // Initialize button visual states
    updateFormattingButtonStates()

    // Observe keyboard to lift toolbar above it
    NotificationCenter.default.addObserver(self, selector: #selector(keyboardWillShow(_:)), name: UIResponder.keyboardWillShowNotification, object: nil)
    NotificationCenter.default.addObserver(self, selector: #selector(keyboardWillHide(_:)), name: UIResponder.keyboardWillHideNotification, object: nil)
  }

  private func createToolbarButton(title: String, action: Selector) -> UIButton {
    let button = UIButton(type: .system)
    let attributes: [NSAttributedString.Key: Any] = [
      .foregroundColor: UIColor.label.withAlphaComponent(0.6),
      .font: UIFont.systemFont(ofSize: 16)
    ]
    let attributedTitle = NSAttributedString(string: title, attributes: attributes)
    button.setAttributedTitle(attributedTitle, for: .normal)
    button.contentEdgeInsets = UIEdgeInsets(top: 8, left: 0, bottom: 8, right: 0)
    button.backgroundColor = UIColor.secondarySystemBackground
    button.layer.cornerRadius = 8
    button.addTarget(self, action: action, for: .touchUpInside)
    return button
  }

  // MARK: - Public Commands (invoked by Manager)

  @objc func setText(_ text: NSString) {
    let attributed = NSMutableAttributedString(string: text as String, attributes: defaultTypingAttributes())
    textView.attributedText = attributed
    textView.selectedRange = NSRange(location: attributed.length, length: 0)
    sendChangeEvent()
  }

  @objc func setBold() {
    toggleFontTrait(.traitBold)
    updateFormattingButtonStates()
  }

  @objc func setItalic() {
    toggleFontTrait(.traitItalic)
    updateFormattingButtonStates()
  }

  @objc func setUnderline() {
    toggleUnderline()
    updateFormattingButtonStates()
  }

  @objc func toggleBulletedList() {
    guard let current = textView.attributedText else { return }
    let mutable = NSMutableAttributedString(attributedString: current)
    let string = mutable.string as NSString
    let selection = textView.selectedRange

    // Special case: handle empty text (no content at all)
    if string.length == 0 {
      let bullet = NSAttributedString(string: "• ", attributes: self.defaultTypingAttributes())
      mutable.append(bullet)
      textView.attributedText = mutable
      textView.selectedRange = NSRange(location: 2, length: 0)
      sendChangeEvent()
      return
    }

    let startLine = string.lineRange(for: NSRange(location: selection.location, length: 0))
    let endLocation = min(selection.location + selection.length, string.length)
    let endLine = string.lineRange(for: NSRange(location: endLocation, length: 0))
    let affected = NSUnionRange(startLine, endLine)

    // Check if we're at the very end of text AND the current line is empty
    let currentLineString = string.substring(with: startLine)
    let isCurrentLineEmpty = currentLineString.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    
    // Special case: handle cursor at end of text with no trailing newline AND current line is empty
    if selection.location == string.length && !string.hasSuffix("\n") && isCurrentLineEmpty {
      // Only create a new line if we're at the end and the current line is empty
      let newlineAndBullet = NSAttributedString(string: "\n• ", attributes: self.defaultTypingAttributes())
      mutable.append(newlineAndBullet)
      textView.attributedText = mutable
      textView.selectedRange = NSRange(location: mutable.length, length: 0)
      sendChangeEvent()
      return
    }

    var delta = 0
    var hasProcessedAnyLine = false
    
    string.enumerateSubstrings(in: affected, options: .byLines) { _, lineRange, _, _ in
      hasProcessedAnyLine = true
      let adjusted = NSRange(location: lineRange.location + delta, length: lineRange.length)
      let lineString = (mutable.string as NSString).substring(with: adjusted)
      if lineString.hasPrefix("• ") {
        mutable.deleteCharacters(in: NSRange(location: adjusted.location, length: 2))
        delta -= 2
      } else {
        let bullet = NSAttributedString(string: "• ", attributes: self.defaultTypingAttributes())
        mutable.insert(bullet, at: adjusted.location)
        delta += 2
      }
    }

    // If no lines were processed (e.g., truly empty line), handle cursor position manually
    if !hasProcessedAnyLine {
      let bullet = NSAttributedString(string: "• ", attributes: self.defaultTypingAttributes())
      mutable.insert(bullet, at: selection.location)
      delta = 2
    }

    textView.attributedText = mutable
    let newSelection = NSRange(location: selection.location + delta, length: max(0, selection.length))
    textView.selectedRange = newSelection
    sendChangeEvent()
  }

  @objc func toggleCheckbox() {
    guard let current = textView.attributedText else { return }
    let mutable = NSMutableAttributedString(attributedString: current)
    let string = mutable.string as NSString
    let selection = textView.selectedRange

    // Special case: handle empty text (no content at all)
    if string.length == 0 {
      let checkbox = NSAttributedString(string: "☐ ", attributes: self.defaultTypingAttributes())
      mutable.append(checkbox)
      textView.attributedText = mutable
      textView.selectedRange = NSRange(location: 2, length: 0)
      sendChangeEvent()
      return
    }

    let startLine = string.lineRange(for: NSRange(location: selection.location, length: 0))
    let endLocation = min(selection.location + selection.length, string.length)
    let endLine = string.lineRange(for: NSRange(location: endLocation, length: 0))
    let affected = NSUnionRange(startLine, endLine)

    // Check if we're at the very end of text AND the current line is empty
    let currentLineString = string.substring(with: startLine)
    let isCurrentLineEmpty = currentLineString.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    
    // Special case: handle cursor at end of text with no trailing newline AND current line is empty
    if selection.location == string.length && !string.hasSuffix("\n") && isCurrentLineEmpty {
      // Only create a new line if we're at the end and the current line is empty
      let newlineAndCheckbox = NSAttributedString(string: "\n☐ ", attributes: self.defaultTypingAttributes())
      mutable.append(newlineAndCheckbox)
      textView.attributedText = mutable
      textView.selectedRange = NSRange(location: mutable.length, length: 0)
      sendChangeEvent()
      return
    }

    var delta = 0
    var hasProcessedAnyLine = false
    
    string.enumerateSubstrings(in: affected, options: .byLines) { _, lineRange, _, _ in
      hasProcessedAnyLine = true
      let adjusted = NSRange(location: lineRange.location + delta, length: lineRange.length)
      let lineString = (mutable.string as NSString).substring(with: adjusted)
      if lineString.hasPrefix("☐ ") || lineString.hasPrefix("☑ ") {
        // Remove existing checkbox (either checked or unchecked)
        mutable.deleteCharacters(in: NSRange(location: adjusted.location, length: 2))
        delta -= 2
      } else {
        // Add new unchecked checkbox
        let box = NSAttributedString(string: "☐ ", attributes: self.defaultTypingAttributes())
        mutable.insert(box, at: adjusted.location)
        delta += 2
      }
    }

    // If no lines were processed (e.g., truly empty line), handle cursor position manually
    if !hasProcessedAnyLine {
      let box = NSAttributedString(string: "☐ ", attributes: self.defaultTypingAttributes())
      mutable.insert(box, at: selection.location)
      delta = 2
    }

    textView.attributedText = mutable
    let newSelection = NSRange(location: selection.location + delta, length: max(0, selection.length))
    textView.selectedRange = newSelection
    sendChangeEvent()
  }

  @objc func insertLink(_ urlString: NSString, title: NSString?) {
    guard let url = URL(string: urlString as String) else { return }

    var effectiveTitle: String?
    if let titleStr = title as String?, !titleStr.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
      effectiveTitle = titleStr
    }

    let selectedRange = textView.selectedRange
    let mutable = NSMutableAttributedString(attributedString: textView.attributedText ?? NSAttributedString(string: ""))

    if selectedRange.length > 0 {
      // Apply link to selected text
      mutable.addAttribute(.link, value: url, range: selectedRange)
    } else {
      // Insert a new linked text at the cursor
      let linkText = effectiveTitle ?? url.absoluteString
      let linkAttributed = NSMutableAttributedString(string: linkText, attributes: defaultTypingAttributes())
      linkAttributed.addAttribute(.link, value: url, range: NSRange(location: 0, length: linkAttributed.length))
      mutable.insert(linkAttributed, at: selectedRange.location)
      textView.selectedRange = NSMakeRange(selectedRange.location + linkAttributed.length, 0)
    }

    textView.attributedText = mutable
    sendChangeEvent()
  }

  // MARK: - Markdown Processing

  private func processMarkdownSyntax() {
    print("processMarkdownSyntax");
    guard let attributedText = textView.attributedText else { return }
    let mutableText = NSMutableAttributedString(attributedString: attributedText)
    let text = mutableText.string
    let currentSelection = textView.selectedRange
    
    // Only process if we just typed something (cursor at end of insertion)
    guard currentSelection.length == 0 && currentSelection.location > 0 else { 
      print("🔍 Skipping markdown processing - invalid selection")
      return 
    }
    
    // Check if we just typed a space (common trigger for markdown)
    let lastChar = (text as NSString).character(at: currentSelection.location - 1)
    let justTypedSpace = lastChar == 32 // ASCII space
    
    print("🔍 Last character typed: \(lastChar) (\(Character(UnicodeScalar(lastChar)!))) | justTypedSpace: \(justTypedSpace)")
    
    // Get the current line
    let currentLineRange = (text as NSString).lineRange(for: NSRange(location: currentSelection.location - 1, length: 0))
    let currentLine = (text as NSString).substring(with: currentLineRange)
    
    print("🔍 Current line range: \(currentLineRange) | Current line: '\(currentLine)'")
    
    var didTransform = false
    var newCursorPosition = currentSelection.location
    
    // Process different markdown patterns
    if let transformResult = processMarkdownLine(currentLine, range: currentLineRange, mutableText: mutableText, justTypedSpace: justTypedSpace) {
      didTransform = true
      newCursorPosition = transformResult.newCursorPosition
    }
    
    if didTransform {
      print("✅ Markdown transformation applied!")
      textView.attributedText = mutableText
      textView.selectedRange = NSRange(location: newCursorPosition, length: 0)
    } else {
      print("❌ No markdown transformation applied")
    }
  }
  
  private struct MarkdownTransformResult {
    let newCursorPosition: Int
  }
  
  private func processMarkdownLine(_ line: String, range: NSRange, mutableText: NSMutableAttributedString, justTypedSpace: Bool) -> MarkdownTransformResult? {
    let trimmedLine = line.trimmingCharacters(in: .whitespacesAndNewlines)
    
    // Header patterns (## Header, ### Header, etc.) - trigger on space
    if justTypedSpace, let headerResult = processHeaderPattern(line: line, range: range, mutableText: mutableText) {
      return headerResult
    }
    
    // Bullet point pattern (* text) - trigger on space
    if justTypedSpace, let bulletResult = processBulletPattern(line: line, range: range, mutableText: mutableText) {
      return bulletResult
    }
    
    // Bold and italic patterns - trigger when completing the pattern (typing closing *)
    let nsLine = line as NSString
    let justTypedAsterisk = nsLine.length > 0 && nsLine.character(at: nsLine.length - 1) == 42 // ASCII asterisk
    
    if justTypedAsterisk {
      // Bold pattern (**text**)
      if let boldResult = processBoldPattern(line: line, range: range, mutableText: mutableText) {
        return boldResult
      }
      
      // Italic pattern (*text*)
      if let italicResult = processItalicPattern(line: line, range: range, mutableText: mutableText) {
        return italicResult
      }
    }
    
    return nil
  }
  
  private func processHeaderPattern(line: String, range: NSRange, mutableText: NSMutableAttributedString) -> MarkdownTransformResult? {
    // Don't trim the line - we need to preserve the space
    let nsLine = line as NSString
    
    // Match patterns like "# " or "## " - just hashes followed by space (text after is optional)
    let headerRegex = try! NSRegularExpression(pattern: "^\\s*(#{1,6})\\s$")
    
    if let match = headerRegex.firstMatch(in: line, range: NSRange(location: 0, length: nsLine.length)) {
      let hashesRange = match.range(at: 1)
      let headerLevel = hashesRange.length
      
      let fontSize: CGFloat = 24 - CGFloat(headerLevel - 1) * 2 // H1=24, H2=22, H3=20, etc.
      let headerFont = UIFont.boldSystemFont(ofSize: max(fontSize, 16))
      
      let headerAttributes: [NSAttributedString.Key: Any] = [
        .font: headerFont,
        .foregroundColor: UIColor.label
      ]
      
      // Replace the entire line with just a cursor positioned for typing
      let replacement = NSAttributedString(string: "", attributes: headerAttributes)
      mutableText.replaceCharacters(in: range, with: replacement)
      
      // Set typing attributes for future text
      DispatchQueue.main.async {
        self.textView.typingAttributes = headerAttributes
      }
      
      return MarkdownTransformResult(newCursorPosition: range.location)
    }
    
    return nil
  }
  
  private func processBulletPattern(line: String, range: NSRange, mutableText: NSMutableAttributedString) -> MarkdownTransformResult? {
    let trimmedLine = line.trimmingCharacters(in: .whitespacesAndNewlines)
    
    // Match "* " at the beginning of line (must have space after asterisk)
    if trimmedLine.hasPrefix("* ") {
      let bulletText = String(trimmedLine.dropFirst(2)) // Remove "* "
      let replacement = NSAttributedString(string: "• \(bulletText)", attributes: defaultTypingAttributes())
      mutableText.replaceCharacters(in: range, with: replacement)
      
      return MarkdownTransformResult(newCursorPosition: range.location + replacement.length)
    }
    
    return nil
  }
  
  private func processBoldPattern(line: String, range: NSRange, mutableText: NSMutableAttributedString) -> MarkdownTransformResult? {
    // Match **text** pattern
    let boldRegex = try! NSRegularExpression(pattern: "\\*\\*([^*]+)\\*\\*")
    let nsLine = line as NSString
    
    if let match = boldRegex.firstMatch(in: line, range: NSRange(location: 0, length: nsLine.length)) {
      let textRange = match.range(at: 1)
      let boldText = nsLine.substring(with: textRange)
      
      let boldAttributes: [NSAttributedString.Key: Any] = [
        .font: UIFont.boldSystemFont(ofSize: UIFont.preferredFont(forTextStyle: .body).pointSize),
        .foregroundColor: UIColor.label
      ]
      
      // Replace the entire match (including **) with bold text
      let matchRange = NSRange(location: range.location + match.range.location, length: match.range.length)
      let replacement = NSAttributedString(string: boldText, attributes: boldAttributes)
      mutableText.replaceCharacters(in: matchRange, with: replacement)
      
      return MarkdownTransformResult(newCursorPosition: matchRange.location + replacement.length)
    }
    
    return nil
  }
  
  private func processItalicPattern(line: String, range: NSRange, mutableText: NSMutableAttributedString) -> MarkdownTransformResult? {
    // Match *text* pattern (but not **text**)
    let italicRegex = try! NSRegularExpression(pattern: "(?<!\\*)\\*([^*]+)\\*(?!\\*)")
    let nsLine = line as NSString
    
    if let match = italicRegex.firstMatch(in: line, range: NSRange(location: 0, length: nsLine.length)) {
      let textRange = match.range(at: 1)
      let italicText = nsLine.substring(with: textRange)
      
      let italicAttributes: [NSAttributedString.Key: Any] = [
        .font: UIFont.italicSystemFont(ofSize: UIFont.preferredFont(forTextStyle: .body).pointSize),
        .foregroundColor: UIColor.label
      ]
      
      // Replace the entire match (including *) with italic text
      let matchRange = NSRange(location: range.location + match.range.location, length: match.range.length)
      let replacement = NSAttributedString(string: italicText, attributes: italicAttributes)
      mutableText.replaceCharacters(in: matchRange, with: replacement)
      
      return MarkdownTransformResult(newCursorPosition: matchRange.location + replacement.length)
    }
    
    return nil
  }

  // MARK: - UITextViewDelegate

  func textViewDidChange(_ textView: UITextView) {
    print("textViewDidChange");
    processMarkdownSyntax()
    sendChangeEvent()
    updateFormattingButtonStates()
  }

  func textViewDidChangeSelection(_ textView: UITextView) {
    updateFormattingButtonStates()
  }

  // MARK: - Toolbar Actions

  @objc private func handleBoldTapped() { setBold() }
  @objc private func handleItalicTapped() { setItalic() }
  @objc private func handleUnderlineTapped() { setUnderline() }
  @objc private func handleBulletTapped() { toggleBulletedList() }
  @objc private func handleCheckboxTapped() { toggleCheckbox() }

  // MARK: - Tap Gesture Handling

  @objc private func handleTextViewTap(_ gesture: UITapGestureRecognizer) {
    let location = gesture.location(in: textView)
    let textPosition = textView.closestPosition(to: location)
    
    guard let textPosition = textPosition else { return }
    
    let index = textView.offset(from: textView.beginningOfDocument, to: textPosition)
    
    // Check if the tap is on a checkbox character
    if let checkboxRange = findCheckboxAt(index: index) {
      toggleCheckboxAt(range: checkboxRange)
      return
    }
    
    // Allow normal text view behavior for non-checkbox taps
    // The gesture recognizer delegate method will handle this
  }

  private func findCheckboxAt(index: Int) -> NSRange? {
    guard let attributedText = textView.attributedText else { return nil }
    let text = attributedText.string as NSString
    
    // Check if we're within bounds
    guard index >= 0 && index < text.length else { return nil }
    
    // Look for checkbox characters around the tap location
    // Check the character at the tap location and nearby characters (within 2 characters)
    let searchStart = max(0, index - 2)
    let searchEnd = min(text.length, index + 3)
    
    for i in searchStart..<searchEnd {
      let char = text.character(at: i)
      if char == 0x2610 || char == 0x2611 { // ☐ or ☑
        // Found a checkbox character, return its range
        return NSRange(location: i, length: 1)
      }
    }
    
    return nil
  }

  private func toggleCheckboxAt(range: NSRange) {
    guard let current = textView.attributedText else { return }
    let mutable = NSMutableAttributedString(attributedString: current)
    let text = mutable.string as NSString
    
    guard range.location >= 0 && range.location < text.length else { return }
    
    let char = text.character(at: range.location)
    let newChar: String
    
    if char == 0x2610 { // ☐ (unchecked)
      newChar = "☑" // ☑ (checked)
    } else if char == 0x2611 { // ☑ (checked)
      newChar = "☐" // ☐ (unchecked)
    } else {
      return // Not a checkbox character
    }
    
    let replacement = NSAttributedString(string: newChar, attributes: mutable.attributes(at: range.location, effectiveRange: nil))
    mutable.replaceCharacters(in: range, with: replacement)
    
    // Preserve the current selection
    let currentSelection = textView.selectedRange
    textView.attributedText = mutable
    textView.selectedRange = currentSelection
    
    sendChangeEvent()
  }

  // MARK: - UIGestureRecognizerDelegate

  func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer, shouldRecognizeSimultaneouslyWith otherGestureRecognizer: UIGestureRecognizer) -> Bool {
    return true
  }

  // MARK: - Formatting Helpers

  @objc private func keyboardWillShow(_ notification: Notification) {
    guard let userInfo = notification.userInfo,
          let frameEnd = userInfo[UIResponder.keyboardFrameEndUserInfoKey] as? CGRect,
          let duration = userInfo[UIResponder.keyboardAnimationDurationUserInfoKey] as? TimeInterval,
          let curveRaw = userInfo[UIResponder.keyboardAnimationCurveUserInfoKey] as? UInt else { return }

    // Convert keyboard frame to local coordinates to compute overlap
    let keyboardFrameInView = convert(frameEnd, from: nil)
    let overlap = max(0, bounds.maxY - keyboardFrameInView.origin.y)
    lastKeyboardOverlap = overlap
    keyboardVisible = true
    updateToolbarBottomConstraint(animated: false)

    let options = UIView.AnimationOptions(rawValue: curveRaw << 16)
    UIView.animate(withDuration: duration, delay: 0, options: options, animations: {
      self.layoutIfNeeded()
    })
  }

  @objc private func keyboardWillHide(_ notification: Notification) {
    guard let userInfo = notification.userInfo,
          let duration = userInfo[UIResponder.keyboardAnimationDurationUserInfoKey] as? TimeInterval,
          let curveRaw = userInfo[UIResponder.keyboardAnimationCurveUserInfoKey] as? UInt else { return }
    keyboardVisible = false
    lastKeyboardOverlap = 0
    updateToolbarBottomConstraint(animated: false)
    let options = UIView.AnimationOptions(rawValue: curveRaw << 16)
    UIView.animate(withDuration: duration, delay: 0, options: options, animations: {
      self.layoutIfNeeded()
    })
  }

  deinit {
    NotificationCenter.default.removeObserver(self)
  }

  private func toggleUnderline() {
    let range = textView.selectedRange
    guard let current = textView.attributedText else { return }
    let mutable = NSMutableAttributedString(attributedString: current)

    if range.length == 0 {
      // Toggle for future typing
      let currentUnderline = (textView.typingAttributes[.underlineStyle] as? NSNumber)?.intValue ?? 0
      let newStyle: NSUnderlineStyle = currentUnderline == NSUnderlineStyle.single.rawValue ? [] : .single
      if newStyle == [] {
        textView.typingAttributes.removeValue(forKey: .underlineStyle)
      } else {
        textView.typingAttributes[.underlineStyle] = newStyle.rawValue
      }
      return
    }

    mutable.enumerateAttribute(.underlineStyle, in: range, options: []) { value, subrange, _ in
      let isUnderlined = (value as? NSNumber)?.intValue == NSUnderlineStyle.single.rawValue
      if isUnderlined {
        mutable.removeAttribute(.underlineStyle, range: subrange)
      } else {
        mutable.addAttribute(.underlineStyle, value: NSUnderlineStyle.single.rawValue, range: subrange)
      }
    }

    textView.attributedText = mutable
    textView.selectedRange = range
    // Do not send change event here; caller handles it to avoid duplicate events
  }

  private func toggleFontTrait(_ trait: UIFontDescriptor.SymbolicTraits) {
    let range = textView.selectedRange
    guard let current = textView.attributedText else { return }
    let mutable = NSMutableAttributedString(attributedString: current)

    if range.length == 0 {
      // Toggle typing attribute for future text
      let baseFont = (textView.typingAttributes[.font] as? UIFont) ?? UIFont.preferredFont(forTextStyle: .body)
      let hasTrait = baseFont.fontDescriptor.symbolicTraits.contains(trait)
      let toggledFont = font(base: baseFont, applying: trait, enable: !hasTrait)
      textView.typingAttributes[.font] = toggledFont
      return
    }

    mutable.enumerateAttribute(.font, in: range, options: []) { value, subrange, _ in
      let baseFont = (value as? UIFont) ?? UIFont.preferredFont(forTextStyle: .body)
      let hasTrait = baseFont.fontDescriptor.symbolicTraits.contains(trait)
      let toggledFont = font(base: baseFont, applying: trait, enable: !hasTrait)
      mutable.addAttribute(.font, value: toggledFont, range: subrange)
    }

    textView.attributedText = mutable
    textView.selectedRange = range
    // Do not send change event here; caller handles it to avoid duplicate events
  }

  private func font(base: UIFont, applying trait: UIFontDescriptor.SymbolicTraits, enable: Bool) -> UIFont {
    var traits = base.fontDescriptor.symbolicTraits
    if enable {
      traits.insert(trait)
    } else {
      traits.remove(trait)
    }
    if let descriptor = base.fontDescriptor.withSymbolicTraits(traits) {
      return UIFont(descriptor: descriptor, size: base.pointSize)
    }
    return base
  }

  private func defaultTypingAttributes() -> [NSAttributedString.Key: Any] {
    return [
      .font: UIFont.preferredFont(forTextStyle: .body),
      .foregroundColor: UIColor.label
    ]
  }

  // MARK: - Formatting State and Button UI

  private func updateFormattingButtonStates() {
    let boldActive = isTraitEnabledInCurrentContext(.traitBold)
    let italicActive = isTraitEnabledInCurrentContext(.traitItalic)
    let underlineActive = isUnderlineEnabledInCurrentContext()

    applyStyle(
      to: boldButton,
      title: "B",
      active: boldActive,
      inactiveFont: UIFont.systemFont(ofSize: 16),
      activeFont: UIFont.boldSystemFont(ofSize: 16)
    )
    applyStyle(
      to: italicButton,
      title: "/",
      active: italicActive,
      inactiveFont: UIFont.italicSystemFont(ofSize: 16),
      activeFont: UIFont.italicSystemFont(ofSize: 16)
    )
    applyStyle(
      to: underlineButton,
      title: "U",
      active: underlineActive,
      inactiveFont: UIFont.systemFont(ofSize: 16)
    )
  }

  private func applyStyle(
    to button: UIButton?,
    title: String,
    active: Bool,
    inactiveFont: UIFont,
    activeFont: UIFont? = nil
  ) {
    guard let button = button else { return }
    let resolvedActiveFont = activeFont ?? UIFont.boldSystemFont(ofSize: inactiveFont.pointSize)
    let font = active ? resolvedActiveFont : inactiveFont
    let color = active ? UIColor.label : UIColor.label.withAlphaComponent(0.6)
    let attributedTitle = NSAttributedString(string: title, attributes: [
      .font: font,
      .foregroundColor: color
    ])
    button.setAttributedTitle(attributedTitle, for: .normal)
  }

  private func isTraitEnabledInCurrentContext(_ trait: UIFontDescriptor.SymbolicTraits) -> Bool {
    let selection = textView.selectedRange
    if selection.length == 0 {
      let baseFont = (textView.typingAttributes[.font] as? UIFont) ?? UIFont.preferredFont(forTextStyle: .body)
      return baseFont.fontDescriptor.symbolicTraits.contains(trait)
    }

    var allHaveTrait = true
    textView.attributedText?.enumerateAttribute(.font, in: selection, options: []) { value, _, stop in
      let font = (value as? UIFont) ?? UIFont.preferredFont(forTextStyle: .body)
      if !font.fontDescriptor.symbolicTraits.contains(trait) {
        allHaveTrait = false
        stop.pointee = true
      }
    }
    return allHaveTrait
  }

  private func isUnderlineEnabledInCurrentContext() -> Bool {
    let selection = textView.selectedRange
    if selection.length == 0 {
      let underline = (textView.typingAttributes[.underlineStyle] as? NSNumber)?.intValue ?? 0
      return underline == NSUnderlineStyle.single.rawValue
    }

    var allUnderlined = true
    textView.attributedText?.enumerateAttribute(.underlineStyle, in: selection, options: []) { value, _, stop in
      let isUnderlined = (value as? NSNumber)?.intValue == NSUnderlineStyle.single.rawValue
      if !isUnderlined {
        allUnderlined = false
        stop.pointee = true
      }
    }
    return allUnderlined
  }

  private func updateToolbarBottomConstraint(animated: Bool) {
    let extra = CGFloat(additionalBottomInset?.doubleValue ?? 0)
    // When keyboard is visible, lift toolbar above keyboard + extra overlay inset
    let target = keyboardVisible ? -(lastKeyboardOverlap + extra) : -extra
    toolbarBottomConstraint?.constant = target
    if animated {
      UIView.animate(withDuration: 0.2) {
        self.layoutIfNeeded()
      }
    }
  }

  private func sendChangeEvent() {
    guard let onChange = onChange else { return }
    let plain = textView.attributedText?.string ?? ""
    onChange(["text": plain])
  }
}


