import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { requireNativeComponent, UIManager, findNodeHandle, ViewProps, NativeSyntheticEvent } from 'react-native';

type ChangeEvent = NativeSyntheticEvent<{ text: string }>

export type NativeRichTextEditorProps = ViewProps & {
  onChange?: (e: ChangeEvent) => void;
  additionalBottomInset?: number;
}

export type NativeRichTextEditorHandle = {
  setText: (text: string) => void;
  setBold: () => void;
  setItalic: () => void;
  setUnderline: () => void;
  insertLink: (url: string, title?: string) => void;
  toggleBulletedList: () => void;
  toggleCheckbox: () => void;
}

const COMPONENT_NAME = 'NativeRichTextEditor';

const NativeComponent = requireNativeComponent<NativeRichTextEditorProps>(COMPONENT_NAME);

function getCommands() {
  // RN 0.71+ supports getViewManagerConfig; fallback to UIManager[MANAGER_NAME]
  // Types are loose because UIManager types do not include custom managers
  const config: any = (UIManager as any).getViewManagerConfig
    ? (UIManager as any).getViewManagerConfig(COMPONENT_NAME)
    : (UIManager as any)[COMPONENT_NAME];

  return config?.Commands || {};
}

export const NativeRichTextEditor = forwardRef<NativeRichTextEditorHandle, NativeRichTextEditorProps>((props, ref) => {
  const nativeRef = useRef(null);

  useImperativeHandle(ref, () => ({
    setText(text: string) {
      dispatch('setText', [text]);
    },
    setBold() {
      dispatch('setBold');
    },
    setItalic() {
      dispatch('setItalic');
    },
    setUnderline() {
      dispatch('setUnderline');
    },
    insertLink(url: string, title?: string) {
      dispatch('insertLink', [url, title ?? '']);
    },
    toggleBulletedList() {
      dispatch('toggleBulletedList');
    },
    toggleCheckbox() {
      dispatch('toggleCheckbox');
    }
  }));

  function dispatch(commandName: string, args: any[] = []) {
    const node = findNodeHandle(nativeRef.current);
    if (!node) return;

    const commands = getCommands();
    const commandId = commands[commandName];
    if (commandId == null) return;

    UIManager.dispatchViewManagerCommand(node, commandId, args);
  }

  return <NativeComponent ref={nativeRef} {...props} />;
});

export default NativeRichTextEditor;


