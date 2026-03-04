import ELK from 'elkjs/lib/elk.bundled.js'

const elk = new ELK()

interface LayoutNode { id: string; width: number; height: number }
interface LayoutEdge { id: string; sources: string[]; targets: string[] }

export async function getLayoutedElements(
  nodes: LayoutNode[],
  edges: LayoutEdge[]
): Promise<Map<string, { x: number; y: number }>> {
  const graph = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'DOWN',
      'elk.spacing.nodeNode': '80',
      'elk.layered.spacing.nodeNodeBetweenLayers': '100',
    },
    children: nodes.map(n => ({ id: n.id, width: n.width, height: n.height })),
    edges: edges.map(e => ({ id: e.id, sources: e.sources, targets: e.targets })),
  }

  const laid = await elk.layout(graph)
  const positions = new Map<string, { x: number; y: number }>()
  for (const child of laid.children ?? []) {
    positions.set(child.id, { x: child.x ?? 0, y: child.y ?? 0 })
  }
  return positions
}
