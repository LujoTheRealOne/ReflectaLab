#import <React/RCTViewManager.h>
#import <React/RCTUIManager.h>

// DO NOT import "Reflecta-Swift.h" here; it causes a duplicate interface

// Export the view as 'NativeRichTextEditor' for requireNativeComponent('NativeRichTextEditor')
@interface RCT_EXTERN_REMAP_MODULE(NativeRichTextEditor, NativeRichTextEditorManager, RCTViewManager)

RCT_EXPORT_VIEW_PROPERTY(onChange, RCTBubblingEventBlock)
RCT_EXPORT_VIEW_PROPERTY(additionalBottomInset, NSNumber)

RCT_EXTERN_METHOD(setText:(nonnull NSNumber *)reactTag text:(NSString *)text)
RCT_EXTERN_METHOD(setBold:(nonnull NSNumber *)reactTag)
RCT_EXTERN_METHOD(setItalic:(nonnull NSNumber *)reactTag)
RCT_EXTERN_METHOD(setUnderline:(nonnull NSNumber *)reactTag)
RCT_EXTERN_METHOD(insertLink:(nonnull NSNumber *)reactTag urlString:(NSString *)urlString title:(NSString *)title)
RCT_EXTERN_METHOD(toggleBulletedList:(nonnull NSNumber *)reactTag)
RCT_EXTERN_METHOD(toggleCheckbox:(nonnull NSNumber *)reactTag)

@end


