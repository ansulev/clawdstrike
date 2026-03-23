/**
 * ContributionInspector - Right sidebar panel showing playground plugin contributions.
 *
 * Displays the ContributionSnapshot from the playground store, listing
 * guards, commands, file types, and view contributions registered by the
 * most recently run playground plugin.
 */
import { usePlaygroundContributions } from "@/lib/plugins/playground/playground-store";

function Section({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="mb-3">
      <h4 className="text-[10px] font-semibold uppercase tracking-wider text-[#6f7f9a] mb-1">
        {title}
      </h4>
      <ul className="space-y-0.5">
        {items.map((item) => (
          <li key={item} className="text-xs text-[#c8d1e0] px-1 py-0.5 rounded bg-[#1a1f2e]">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ContributionInspector() {
  const contributions = usePlaygroundContributions();

  if (!contributions) {
    return (
      <div className="flex items-center justify-center h-full text-[#6f7f9a] text-xs p-4">
        Run a plugin to see its contributions
      </div>
    );
  }

  return (
    <div className="p-3 overflow-y-auto h-full text-[#c8d1e0]">
      <h3 className="text-xs font-semibold mb-3 text-[#d4a84b]">Plugin Contributions</h3>
      <Section title="Guards" items={contributions.guards} />
      <Section title="Commands" items={contributions.commands} />
      <Section title="File Types" items={contributions.fileTypes} />
      <Section title="Editor Tabs" items={contributions.editorTabs} />
      <Section title="Bottom Panel Tabs" items={contributions.bottomPanelTabs} />
      <Section title="Right Sidebar Panels" items={contributions.rightSidebarPanels} />
      <Section title="Status Bar Items" items={contributions.statusBarItems} />
    </div>
  );
}

export default ContributionInspector;
