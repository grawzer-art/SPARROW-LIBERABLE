import { NodeIO } from '@gltf-transform/core';
import { prune } from '@gltf-transform/functions';
const io = new NodeIO();
for (const [src, dst] of [['../assets/Xbot.glb', 'anim_xbot.glb'], ['../assets/Soldier.glb', 'anim_soldier.glb']]) {
  const doc = await io.read(src);
  const root = doc.getRoot();
  for (const n of root.listNodes()) { n.setMesh(null); n.setSkin(null); }
  for (const m of root.listMeshes()) m.dispose();
  for (const s of root.listSkins()) s.dispose();
  for (const m of root.listMaterials()) m.dispose();
  for (const t of root.listTextures()) t.dispose();
  await doc.transform(prune());
  await io.write(dst, doc);
  console.log(dst, root.listAnimations().map((a) => a.getName() + ':' + a.listChannels().length));
}
