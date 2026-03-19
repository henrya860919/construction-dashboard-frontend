export type DrawingLatestFile = {
  id: string
  fileName: string
  fileSize: number
  mimeType: string
  createdAt: string
}

export type DrawingNodeTree = {
  id: string
  kind: 'folder' | 'leaf'
  name: string
  latestFile: DrawingLatestFile | null
  children?: DrawingNodeTree[]
}

export type DrawingFlatItem = {
  node: DrawingNodeTree
  depth: number
  hasChildren: boolean
  parentId: string | null
}

export type DrawingRevisionItem = {
  id: string
  fileName: string
  fileSize: number
  mimeType: string
  createdAt: string
  uploadedBy: { id: string; name: string | null; email: string } | null
  url: string
}
