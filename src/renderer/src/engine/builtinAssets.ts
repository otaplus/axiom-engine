import type { Asset } from './types'

const emoji = (id: string, name: string, glyph: string, background?: string): Asset => ({
  id,
  name,
  kind: 'emoji',
  glyph,
  background,
  size: 96
})

const shape = (
  id: string,
  name: string,
  form: 'rect' | 'circle' | 'triangle' | 'star' | 'hexagon' | 'diamond',
  color: string,
  color2?: string
): Asset => ({ id, name, kind: 'shape', shape: form, color, color2, size: 96 })

export const BUILTIN_ASSETS: Asset[] = [
  emoji('hero', 'Héroe', '🦊'),
  emoji('robot', 'Robot', '🤖'),
  emoji('frog', 'Rana', '🐸'),
  emoji('ghost', 'Fantasma', '👻'),
  emoji('alien', 'Alien', '👾'),
  emoji('ninja', 'Ninja', '🥋'),
  emoji('wizard', 'Mago', '🧙'),
  emoji('knight', 'Caballero', '🛡️'),
  emoji('ship', 'Nave', '🚀'),
  emoji('ufo', 'OVNI', '🛸'),
  {
    id: 'slime',
    name: 'Slime',
    kind: 'vector',
    variant: 'slime',
    color: '#4ade80',
    color2: '#15803d',
    size: 96
  },
  emoji('bat', 'Murciélago', '🦇'),
  emoji('crab', 'Cangrejo', '🦀'),
  emoji('bee', 'Abeja', '🐝'),
  emoji('dragon', 'Dragón', '🐉'),
  emoji('zombie', 'Zombi', '🧟'),
  emoji('gem', 'Gema', '💎'),
  emoji('star', 'Estrella', '⭐'),
  emoji('heart', 'Corazón', '❤️'),
  emoji('key', 'Llave', '🗝️'),
  emoji('bomb', 'Bomba', '💣'),
  emoji('potion', 'Poción', '🧪'),
  emoji('flag', 'Meta', '🏁'),
  emoji('fire', 'Fuego', '🔥'),
  emoji('ice', 'Hielo', '❄️'),
  emoji('bolt', 'Rayo', '⚡'),
  emoji('mushroom', 'Seta', '🍄'),
  emoji('flower', 'Flor', '🌸'),
  emoji('cactus', 'Cactus', '🌵'),
  emoji('rock', 'Roca', '🗿'),
  emoji('cloud', 'Nube', '☁️'),
  emoji('tree', 'Árbol', '🌳'),
  emoji('apple', 'Manzana', '🍎'),
  emoji('skull', 'Calavera', '💀'),
  emoji('portal', 'Portal', '🌀'),
  emoji('spark', 'Chispa', '✨'),
  emoji('magnet', 'Imán', '🧲'),
  emoji('shield', 'Escudo', '🛡️'),
  emoji('target', 'Diana', '🎯'),
  emoji('sword', 'Espada', '⚔️'),
  emoji('crown', 'Corona', '👑'),
  {
    id: 'coin',
    name: 'Moneda de oro',
    kind: 'vector',
    variant: 'coin',
    color: '#fbbf24',
    color2: '#f59e0b',
    size: 96
  },
  {
    id: 'vector_heart',
    name: 'Corazón vectorial',
    kind: 'vector',
    variant: 'heart',
    color: '#fb7185',
    color2: '#be123c',
    size: 96
  },
  {
    id: 'vector_star',
    name: 'Estrella dorada',
    kind: 'vector',
    variant: 'star',
    color: '#fde047',
    color2: '#f59e0b',
    size: 96
  },
  shape('platform', 'Plataforma neón', 'rect', '#1e293b', '#38bdf8'),
  shape('orb', 'Orbe', 'circle', '#22d3ee', '#6366f1'),
  shape('triangle', 'Triángulo', 'triangle', '#f472b6', '#7c3aed'),
  shape('star_shape', 'Estrella vectorial', 'star', '#facc15', '#f97316'),
  shape('hex', 'Hexágono', 'hexagon', '#34d399', '#0ea5e9'),
  shape('diamond', 'Rombo', 'diamond', '#a78bfa', '#ec4899')
]

export function cloneBuiltinAssets(): Asset[] {
  return BUILTIN_ASSETS.map((asset) => ({ ...asset }))
}
