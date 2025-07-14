"use dom";

import styles from "@/styles/tiptap.css";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect } from "react";
import { Linking, useColorScheme } from "react-native";

export default function Editor({ content, onUpdate, isLoaded }: { content: string, onUpdate: (content: string) => void, isLoaded: (content: boolean) => void }) {
  const colorScheme = useColorScheme();

  useEffect(() => {
    isLoaded(true);
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: 'Start writing...',
      }),
      Link.configure({
        // autolink: false,
        // shouldAutoLink: (url: string) => {
        //   return false;
        // },
        openOnClick: false,
      }),
      // Link.configure({
      //   openOnClick: false,
      //   HTMLAttributes: {
      //     target: '_blank',
      //     rel: 'noopener noreferrer',
      //   },
      // }),
    ],
    content: content,
    editorProps: {
      attributes: {
        style: `
          width: 100%;
          margin: 0 auto;
          padding: 0;
          outline: none;
          border: none;
          height: 100%;
          min-height: 300px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 16px;
          color: ${colorScheme === 'dark' ? '#ffffff' : '#000000'};
          background: transparent;
        `
      },
      handleClick: (view, pos, event) => {
        const target = event.target as HTMLElement;
        if (target.tagName === 'A' && target.getAttribute('href')) {
          event.preventDefault();
          const href = target.getAttribute('href');
          if (href) {
            Linking.openURL(href);
          }
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor }) => {
      const newContent = editor.getHTML()
      onUpdate(newContent)
    }
  });

  const editorStyles = {
    flex: 1,
    height: '100%',
    border: 'none',
    outline: 'none',
    background: 'transparent',
    overflow: 'auto',
  };

  return (
    <div style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* <style dangerouslySetInnerHTML={{ __html: globalStyles }} /> */}
      <style dangerouslySetInnerHTML={{ __html: styles }} />
      <EditorContent editor={editor} style={editorStyles} />
    </div>
  );
}