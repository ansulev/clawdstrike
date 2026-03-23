/**
 * PlaygroundEditorPane - Wrapper combining toolbar and editor.
 *
 * Arranges PlaygroundToolbar (top) and PlaygroundEditor (fills remaining space)
 * in a flex-col layout. Exported as default for lazy loading from the
 * playground plugin registration.
 */
import { PlaygroundToolbar } from "./PlaygroundToolbar";
import { PlaygroundEditor } from "./PlaygroundEditor";

export function PlaygroundEditorPane() {
  return (
    <div className="flex flex-col h-full w-full bg-[#0d1117]">
      <PlaygroundToolbar />
      <div className="flex-1 min-h-0">
        <PlaygroundEditor />
      </div>
    </div>
  );
}

export default PlaygroundEditorPane;
