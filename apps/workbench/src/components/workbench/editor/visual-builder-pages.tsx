import { useState } from "react";
import { SigmaVisualPanel } from "./sigma-visual-panel";
import { YaraVisualPanel } from "./yara-visual-panel";
import { OcsfVisualPanel } from "./ocsf-visual-panel";

export function SigmaBuilderPage() {
  const [yaml, setYaml] = useState(
    "title: New Sigma Rule\nstatus: experimental\nlogsource:\n  category: process_creation\n  product: windows\ndetection:\n  selection:\n    CommandLine|contains: ''\n  condition: selection\nlevel: medium\n",
  );
  return (
    <div className="h-full w-full overflow-auto bg-[#0b0d13]">
      <SigmaVisualPanel yaml={yaml} onYamlChange={setYaml} />
    </div>
  );
}

export function YaraBuilderPage() {
  const [source, setSource] = useState(
    'rule new_rule {\n  meta:\n    description = ""\n    author = ""\n  strings:\n    $s1 = ""\n  condition:\n    any of them\n}\n',
  );
  return (
    <div className="h-full w-full overflow-auto bg-[#0b0d13]">
      <YaraVisualPanel source={source} onSourceChange={setSource} />
    </div>
  );
}

export function OcsfBuilderPage() {
  const [json, setJson] = useState("{}");
  return (
    <div className="h-full w-full overflow-auto bg-[#0b0d13]">
      <OcsfVisualPanel json={json} onJsonChange={setJson} />
    </div>
  );
}
