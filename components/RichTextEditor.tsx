import React, {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { Keyboard, Platform, StyleSheet, View, Alert, useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RichEditor, RichToolbar, actions } from 'react-native-pell-rich-editor';
import { Colors } from '@/constants/Colors';

export type RichTextEditorHandle = {
  getHtml: () => Promise<string>;
  focus: () => void;
  blur: () => void;
  setHtml: (html: string) => void;
};

type Props = {
  initialHTML?: string;
  onHTMLChange?: (html: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  onLoaded?: (loaded: boolean) => void;
  placeholder?: string;
  // If provided, the editor will reset its content when this key changes (e.g., entry id)
  contentKey?: string;
};

const RichTextEditorInner = forwardRef<RichTextEditorHandle, Props>(
  (
    {
      initialHTML = '',
      onHTMLChange,
      onFocus,
      onBlur,
      onLoaded,
      placeholder = 'Start writing...',
      contentKey,
    },
    ref,
  ) => {
    const colorScheme = useColorScheme();
    const colors = Colors[colorScheme ?? 'light'];
    const insets = useSafeAreaInsets();

    const editorRef = useRef<RichEditor | null>(null);
    const [mounted, setMounted] = useState(false);
    const [isFocused, setIsFocused] = useState(false);
    const latestHtmlRef = useRef<string>(initialHTML || '');
    const changeTimerRef = useRef<NodeJS.Timeout | null>(null);
    const lastEmitAtRef = useRef<number>(0);
    const [toolbarBottomOffset, setToolbarBottomOffset] = useState<number>(0);
    const [toolbarHeight, setToolbarHeight] = useState<number>(48);

    const getThrottleMs = (htmlLength: number) => {
      if (htmlLength > 30000) return 800;
      if (htmlLength > 15000) return 500;
      return 250;
    };

    // Expose imperative API
    useImperativeHandle(ref, () => ({
      getHtml: async () => {
        // @ts-ignore types from library
        const html: string = await editorRef.current?.getContentHtml?.();
        return html || '';
      },
      focus: () => editorRef.current?.focusContentEditor?.(),
      blur: () => editorRef.current?.blurContentEditor?.(),
      setHtml: (html: string) => {
        editorRef.current?.setContentHTML?.(html);
        latestHtmlRef.current = html;
      },
    }));

    // Reset content when contentKey changes (e.g. switching entries)
    useEffect(() => {
      if (!mounted) return;
      if (typeof initialHTML === 'string') {
        editorRef.current?.setContentHTML?.(initialHTML);
        latestHtmlRef.current = initialHTML;
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [contentKey]);

    const emitChangeThrottled = useCallback(() => {
      if (changeTimerRef.current) return;
      const now = Date.now();
      const throttle = getThrottleMs(latestHtmlRef.current?.length || 0);
      const elapsed = now - (lastEmitAtRef.current || 0);
      const delay = Math.max(0, throttle - elapsed);

      changeTimerRef.current = setTimeout(() => {
        onHTMLChange?.(latestHtmlRef.current);
        lastEmitAtRef.current = Date.now();
        changeTimerRef.current = null;
      }, delay);
    }, [onHTMLChange]);

    const handleChange = useCallback((html: string) => {
      latestHtmlRef.current = html;
      emitChangeThrottled();
    }, [emitChangeThrottled]);

    const handleAddLink = useCallback(() => {
      if (Platform.OS === 'ios') {
        // iOS supports Alert.prompt
        Alert.prompt(
          'Insert Link',
          'Enter the URL',
          [
            {
              text: 'Cancel',
              style: 'cancel',
            },
            {
              text: 'Next',
              onPress: (url?: string) => {
                const safeUrl = (url || '').trim();
                if (!safeUrl) return;
                Alert.prompt(
                  'Link Title',
                  'Enter a title for the link',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Insert',
                      onPress: (title?: string) => {
                        const safeTitle = (title || safeUrl).trim();
                        // @ts-ignore
                        editorRef.current?.insertLink?.(safeTitle, safeUrl);
                      },
                    },
                  ],
                  'plain-text',
                );
              },
            },
          ],
          'plain-text',
        );
      } else {
        // Minimal cross-platform fallback
        // @ts-ignore
        editorRef.current?.insertLink?.('Link', 'https://');
      }
    }, []);

    useEffect(() => {
      setMounted(true);
      onLoaded?.(true);
      // Set initial content once mounted
      if (initialHTML) {
        editorRef.current?.setContentHTML?.(initialHTML);
        latestHtmlRef.current = initialHTML;
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
      return () => {
        if (changeTimerRef.current) {
          clearTimeout(changeTimerRef.current);
          changeTimerRef.current = null;
        }
      };
    }, []);

    useEffect(() => {
      const showSub = Keyboard.addListener(
        Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
        (e) => {
          const height = e.endCoordinates?.height || 0;
          setToolbarBottomOffset(height - insets.bottom);
        },
      );
      const hideSub = Keyboard.addListener(
        Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
        () => setToolbarBottomOffset(0),
      );
      return () => {
        showSub.remove();
        hideSub.remove();
      };
    }, [insets.bottom]);

    // Calculate bottom padding so content scrolls above the toolbar
    const contentBottomPaddingPx = Math.max(16, toolbarHeight + Math.max(insets.bottom, 8) + toolbarBottomOffset + 8);

    return (
      <View style={[styles.editorContainer, { backgroundColor: colors.background }]}>
          <RichEditor
            ref={editorRef}
            useContainer={false}
            initialContentHTML={initialHTML}
            placeholder={placeholder}
            editorStyle={{
              backgroundColor: 'transparent',
              color: colors.text,
              placeholderColor: colorScheme === 'dark' ? '#8A8A8E' : '#9A9AA0',
              cssText: '',
              contentCSSText:
                `
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                font-size: 16px;
                line-height: 24px;
                padding: 0 0 ${contentBottomPaddingPx}px 0;
                color: ${colors.text};
                background: transparent;
                word-break: break-word;
                overflow-wrap: anywhere;
              `,
            }}
            style={styles.editor}
            onChange={handleChange}
            editorInitializedCallback={() => onLoaded?.(true)}
            onFocus={() => {
              setIsFocused(true);
              onFocus?.();
            }}
            onBlur={() => {
              setIsFocused(false);
              onBlur?.();
            }}
          />

          {/* Toolbar - shown when focused */}
          {(
            <View
              style={[
                styles.toolbarContainer,
                {
                  backgroundColor: colors.background,
                  borderTopColor: `${colors.tint}12`,
                  paddingBottom: Math.max(insets.bottom, 8),
                  bottom: toolbarBottomOffset,
                },
              ]}
              onLayout={(e) => setToolbarHeight(e.nativeEvent.layout.height)}
            >
              <RichToolbar
                editor={editorRef}
                selectedIconTint={colors.tint}
                iconTint={`${colors.tint}99`}
                style={[styles.toolbar]}
                actions={[
                  actions.setBold,
                  actions.setItalic,
                  actions.setUnderline,
                  actions.insertBulletsList,
                  actions.insertOrderedList,
                  actions.insertLink,
                ]}
                onPressAddLink={handleAddLink}
              />
            </View>
          )}
      </View>
    );
  },
);
const RichTextEditor = memo(RichTextEditorInner);
export default RichTextEditor;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  editorContainer: {
    flex: 1,
    borderRadius: 12,
  },
  editor: {
    flex: 1,
    paddingHorizontal: 0,
    paddingTop: 8,
  },
  toolbarContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  toolbar: {
    borderRadius: 12,
  },
});


