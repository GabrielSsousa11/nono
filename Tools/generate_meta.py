#!/usr/bin/env python3
"""
Gera arquivos .meta ausentes em Assets/ com GUIDs determinísticos (md5 do caminho).

Por que: assets escritos fora da Unity (cena, ScriptableObjects) referenciam scripts e outros
assets por GUID. GUIDs estáveis permitem que essas referências sejam escritas e revisadas no Git.
Metas existentes NUNCA são alterados (a Unity é a dona deles depois de criados).

Uso:
  python3 Tools/generate_meta.py            # cria metas faltantes
  python3 Tools/generate_meta.py --guid Assets/_Project/Scripts/Runtime/Bootstrap/GameBootstrap.cs
"""
import hashlib
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, "Assets")


def guid_for(rel_path: str) -> str:
    rel_path = rel_path.replace("\\", "/")
    return hashlib.md5(("EmpireTycoon:" + rel_path).encode("utf-8")).hexdigest()


def meta_for(rel_path: str, is_dir: bool) -> str:
    guid = guid_for(rel_path)
    head = "fileFormatVersion: 2\nguid: " + guid + "\n"
    tail = "  userData: \n  assetBundleName: \n  assetBundleVariant: \n"
    if is_dir:
        return head + "folderAsset: yes\nDefaultImporter:\n  externalObjects: {}\n" + tail
    ext = os.path.splitext(rel_path)[1].lower()
    if ext == ".cs":
        return (head + "MonoImporter:\n  externalObjects: {}\n  serializedVersion: 2\n  defaultReferences: []\n"
                "  executionOrder: 0\n  icon: {instanceID: 0}\n" + tail)
    if ext == ".asmdef":
        return head + "AssemblyDefinitionImporter:\n  externalObjects: {}\n" + tail
    if ext in (".asset", ".mat"):
        main = "11400000" if ext == ".asset" else "2100000"
        return head + "NativeFormatImporter:\n  externalObjects: {}\n  mainObjectFileID: " + main + "\n" + tail
    if ext in (".md", ".txt", ".json"):
        return head + "TextScriptImporter:\n  externalObjects: {}\n" + tail
    return head + "DefaultImporter:\n  externalObjects: {}\n" + tail


def main() -> int:
    if len(sys.argv) == 3 and sys.argv[1] == "--guid":
        print(guid_for(sys.argv[2]))
        return 0
    created = 0
    for dirpath, dirnames, filenames in os.walk(ASSETS):
        dirnames[:] = [d for d in dirnames if not d.startswith(".") and not d.endswith("~")]
        entries = [(d, True) for d in dirnames] + [(f, False) for f in filenames if not f.endswith(".meta") and not f.startswith(".")]
        for name, is_dir in entries:
            full = os.path.join(dirpath, name)
            meta = full + ".meta"
            if os.path.exists(meta):
                continue
            rel = os.path.relpath(full, ROOT).replace("\\", "/")
            with open(meta, "w", newline="\n") as fh:
                fh.write(meta_for(rel, is_dir))
            created += 1
    print("metas criados:", created)
    return 0


if __name__ == "__main__":
    sys.exit(main())
