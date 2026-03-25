import rdf from 'rdf-ext'

async function rdfAssetsDiff (oldAssets, newAssets) {
  const added = rdf.dataset()
  const removed = rdf.dataset()
  const empty = rdf.dataset()

  for (const { path, dataset } of oldAssets.filter(x => x.dataset)) {
    const newDataset = newAssets.find(x => x.path === path)?.dataset ?? empty
    added.addAll(newDataset.difference(dataset))
    removed.addAll(dataset.difference(newDataset))
  }

  for (const { path, dataset } of newAssets.filter(x => x.dataset)) {
    if (!oldAssets.find(x => x.path === path)) {
      added.addAll(dataset)
    }
  }

  return { added, removed }
}

export { rdfAssetsDiff }
