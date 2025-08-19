import Foundation
import React

@objc(NativeRichTextEditorManager)
class NativeRichTextEditorManager: RCTViewManager {
  override static func requiresMainQueueSetup() -> Bool { true }

  override func constantsToExport() -> [AnyHashable : Any]! {
    // Map command names to numeric IDs for UIManager.dispatchViewManagerCommand
    // Keep ordering stable across builds
    return [
      "Commands": [
        "setText": 0,
        "setBold": 1,
        "setItalic": 2,
        "setUnderline": 3,
        "insertLink": 4,
        "toggleBulletedList": 5,
        "toggleCheckbox": 6
      ]
    ]
  }

  override func view() -> UIView! {
    return NativeRichTextEditor()
  }

  // MARK: - Commands

  @objc func setText(_ reactTag: NSNumber, text: NSString) {
    bridge.uiManager.addUIBlock { (_, viewRegistry) in
      if let view = viewRegistry?[reactTag] as? NativeRichTextEditor {
        view.setText(text)
      }
    }
  }

  @objc func setBold(_ reactTag: NSNumber) {
    bridge.uiManager.addUIBlock { (_, viewRegistry) in
      if let view = viewRegistry?[reactTag] as? NativeRichTextEditor {
        view.setBold()
      }
    }
  }

  @objc func setItalic(_ reactTag: NSNumber) {
    bridge.uiManager.addUIBlock { (_, viewRegistry) in
      if let view = viewRegistry?[reactTag] as? NativeRichTextEditor {
        view.setItalic()
      }
    }
  }

  @objc func setUnderline(_ reactTag: NSNumber) {
    bridge.uiManager.addUIBlock { (_, viewRegistry) in
      if let view = viewRegistry?[reactTag] as? NativeRichTextEditor {
        view.setUnderline()
      }
    }
  }

  @objc func insertLink(_ reactTag: NSNumber, urlString: NSString, title: NSString?) {
    bridge.uiManager.addUIBlock { (_, viewRegistry) in
      if let view = viewRegistry?[reactTag] as? NativeRichTextEditor {
        view.insertLink(urlString, title: title)
      }
    }
  }

  @objc func toggleBulletedList(_ reactTag: NSNumber) {
    bridge.uiManager.addUIBlock { (_, viewRegistry) in
      if let view = viewRegistry?[reactTag] as? NativeRichTextEditor {
        view.toggleBulletedList()
      }
    }
  }

  @objc func toggleCheckbox(_ reactTag: NSNumber) {
    bridge.uiManager.addUIBlock { (_, viewRegistry) in
      if let view = viewRegistry?[reactTag] as? NativeRichTextEditor {
        view.toggleCheckbox()
      }
    }
  }
}


