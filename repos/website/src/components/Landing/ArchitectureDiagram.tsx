import { useState, useCallback } from 'react'
import Box from '@mui/material/Box'
import { useTheme } from '@mui/material/styles'

type NodeDef = {
  id: string
  label: string
  desc: string
  x: number
  y: number
  w: number
  h: number
  fontSize?: number
  fontWeight?: number
}
type PathDef = { id: string; path: string }
type DotDef = PathDef & { dur: number }

/* Loop circle: center=(320, 322.5), radius=97.5
 * Derived from path start (y=225) to path end (y=420) */
const r = 97.5

const allNodes: NodeDef[] = [
  {
    id: 'client',
    label: 'Client',
    desc: 'User entry point — tsa CLI or Threads App',
    x: 235,
    y: 15,
    w: 170,
    h: 44,
  },
  {
    id: 'proxy',
    label: 'Auth Gateway',
    desc: 'Validates JWTs and API keys',
    x: 250,
    y: 100,
    w: 140,
    h: 44,
  },
  {
    id: 'backend',
    label: 'Backend',
    desc: 'Orchestrates sandboxes, secrets, and sessions',
    x: 235,
    y: 185,
    w: 170,
    h: 50,
    fontSize: 14,
    fontWeight: 700,
  },
  {
    id: 'inject',
    label: 'Request',
    desc: 'Tools, context, and secrets injected into the sandbox',
    x: 168,
    y: 300,
    w: 130,
    h: 44,
  },
  {
    id: 'response',
    label: 'Response',
    desc: 'Resolves placeholder tokens to real secrets',
    x: 342,
    y: 300,
    w: 130,
    h: 44,
  },
  {
    id: 'tool',
    label: 'AI Tool',
    desc: 'Runs AI provider tooling (Claude-Code, Codex, Antigravity, OpenClaw, OpenCode, Custom)',
    x: 235,
    y: 410,
    w: 170,
    h: 48,
    fontSize: 14,
    fontWeight: 700,
  },
]

/* Request flow: Client → Proxy → Backend */
const flowPaths: PathDef[] = [
  { id: 'client-proxy', path: 'M320,59 L320,100' },
  { id: 'proxy-backend', path: 'M320,144 L320,185' },
]

/* Counter-clockwise circular loop segments (true circle arcs) */
const loopSegments: PathDef[] = [
  { id: 'backend-inject', path: `M320,225 A${r},${r} 0 0,0 225,300` },
  { id: 'inject-tool', path: `M225,344 A${r},${r} 0 0,0 320,420` },
  { id: 'tool-response', path: `M320,420 A${r},${r} 0 0,0 415,344` },
  { id: 'response-backend', path: `M415,300 A${r},${r} 0 0,0 320,225` },
]

const allVisiblePaths = [...flowPaths, ...loopSegments]

/* Animated dots: full semicircles for smooth loop animation */
const allDots: DotDef[] = [
  { id: 'client-proxy', path: 'M320,59 L320,100', dur: 2 },
  { id: 'proxy-backend', path: 'M320,144 L320,185', dur: 2.3 },
  {
    id: 'inject-dot',
    path: `M320,225 A${r},${r} 0 0,0 320,420`,
    dur: 3.5,
  },
  {
    id: 'response-dot',
    path: `M320,420 A${r},${r} 0 0,0 320,225`,
    dur: 3.8,
  },
]

const ArchitectureDiagram = () => {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)

  const onEnter = useCallback((id: string) => setHoveredNode(id), [])
  const onLeave = useCallback(() => setHoveredNode(null), [])

  const primary = '#3370DE'
  const primaryLight = '#6B9BEA'
  const nodeFill = isDark ? '#21252B' : '#FFFFFF'
  const nodeStroke = isDark ? 'rgba(51,112,222,0.5)' : 'rgba(51,112,222,0.35)'
  const textColor = isDark ? '#E2E8F0' : '#1A1D21'
  const lineColor = isDark ? 'rgba(107,155,234,0.5)' : 'rgba(51,112,222,0.35)'
  const dotColor = isDark ? primaryLight : primary
  const glowColor = isDark ? 'rgba(51,112,222,0.15)' : 'rgba(51,112,222,0.08)'
  const sandboxFill = isDark ? 'rgba(51,112,222,0.06)' : 'rgba(51,112,222,0.03)'
  const sandboxStroke = isDark ? 'rgba(51,112,222,0.3)' : 'rgba(51,112,222,0.2)'
  const labelColor = isDark ? 'rgba(226,232,240,0.5)' : 'rgba(26,29,33,0.4)'
  const tooltipBg = isDark ? '#2A2F38' : '#FFFFFF'
  const tooltipBorder = isDark ? 'rgba(51,112,222,0.4)' : 'rgba(51,112,222,0.25)'
  const tooltipText = isDark ? '#CBD5E1' : '#475569'

  return (
    <Box sx={{ width: '100%', mx: 'auto' }}>
      <svg
        viewBox='95 0 450 510'
        style={{ width: '100%', height: 'auto', overflow: 'visible' }}
        role='img'
        aria-label='Threaded Stack architecture: requests flow from TSA CLI or Browser through Auth Gateway to Backend, which manages sandboxes. Outbound requests pass through the MITM Proxy where placeholder tokens are resolved to real secrets before reaching LLM Providers.'
      >
        <defs>
          <style>{`
            @keyframes dashFlow { to { stroke-dashoffset: -20; } }
            @keyframes nodePulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.8; } }
            .arch-node .hover-glow { opacity: 0; transition: opacity 0.2s; }
            .arch-node:hover .hover-glow { opacity: 1; }
            .arch-node:hover .node-border { stroke-width: 2.5; }
          `}</style>
          <filter id='nodeGlow'>
            <feGaussianBlur
              stdDeviation='4'
              result='blur'
            />
            <feMerge>
              <feMergeNode in='blur' />
              <feMergeNode in='SourceGraphic' />
            </feMerge>
          </filter>
          <filter id='dotGlow'>
            <feGaussianBlur
              stdDeviation='2'
              result='blur'
            />
            <feMerge>
              <feMergeNode in='blur' />
              <feMergeNode in='SourceGraphic' />
            </feMerge>
          </filter>
        </defs>

        {/* Sandbox isolation container */}
        <rect
          x={218}
          y={395}
          width={204}
          height={95}
          rx={16}
          ry={16}
          fill={sandboxFill}
          stroke={sandboxStroke}
          strokeWidth={1.5}
          strokeDasharray='6 3'
        />
        <text
          x={320}
          y={482}
          textAnchor='middle'
          fill={labelColor}
          fontSize={10}
          fontFamily='Ubuntu, sans-serif'
          fontWeight={500}
          letterSpacing={2}
        >
          ISOLATED SANDBOX
        </text>

        {/* Connection lines */}
        {allVisiblePaths.map((c) => (
          <path
            key={c.id}
            d={c.path}
            fill='none'
            stroke={lineColor}
            strokeWidth={1.5}
            strokeDasharray='8 4'
            style={{ animation: 'dashFlow 1.5s linear infinite' }}
          />
        ))}

        {/* Animated dots */}
        {allDots.map((c) => (
          <circle
            key={`dot-${c.id}`}
            r={3}
            fill={dotColor}
            filter='url(#dotGlow)'
          >
            <animateMotion
              dur={`${c.dur}s`}
              repeatCount='indefinite'
              path={c.path}
            />
          </circle>
        ))}

        {/* All nodes — consistent styling */}
        {allNodes.map((node) => (
          <g
            key={node.id}
            className='arch-node'
            style={{ cursor: 'pointer' }}
            onMouseEnter={() => onEnter(node.id)}
            onMouseLeave={onLeave}
          >
            <rect
              x={node.x - 5}
              y={node.y - 5}
              width={node.w + 10}
              height={node.h + 10}
              rx={14}
              ry={14}
              fill={glowColor}
              style={{ animation: 'nodePulse 3s ease-in-out infinite' }}
            />
            <rect
              className='hover-glow'
              x={node.x - 8}
              y={node.y - 8}
              width={node.w + 16}
              height={node.h + 16}
              rx={16}
              ry={16}
              fill='none'
              stroke={primary}
              strokeWidth={1}
              strokeOpacity={0.4}
            />
            <rect
              className='node-border'
              x={node.x}
              y={node.y}
              width={node.w}
              height={node.h}
              rx={12}
              ry={12}
              fill={nodeFill}
              stroke={nodeStroke}
              strokeWidth={1.5}
              filter='url(#nodeGlow)'
              style={{ transition: 'stroke-width 0.2s' }}
            />
            <text
              x={node.x + node.w / 2}
              y={node.y + node.h / 2 + 1}
              textAnchor='middle'
              dominantBaseline='middle'
              fill={textColor}
              fontSize={node.fontSize ?? 13}
              fontFamily='Ubuntu, sans-serif'
              fontWeight={node.fontWeight ?? 600}
            >
              {node.label}
            </text>
          </g>
        ))}

        {/* Tooltip */}
        {hoveredNode &&
          (() => {
            const node = allNodes.find((n) => n.id === hoveredNode)
            if (!node) return null
            const tx = node.x + node.w / 2
            const tipW = 400
            const tipH = 40
            const ty = node.y + node.h + 8
            return (
              <foreignObject
                x={tx - tipW / 2}
                y={ty}
                width={tipW}
                height={tipH}
                style={{ pointerEvents: 'none', overflow: 'visible' }}
              >
                <div
                  style={{
                    width: 'fit-content',
                    margin: '0 auto',
                    background: tooltipBg,
                    border: `1px solid ${tooltipBorder}`,
                    borderRadius: 6,
                    padding: '5px 12px',
                    fontFamily: 'Ubuntu, sans-serif',
                    fontSize: 12,
                    color: tooltipText,
                    textAlign: 'center',
                    whiteSpace: 'nowrap',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                  }}
                >
                  {node.desc}
                </div>
              </foreignObject>
            )
          })()}
      </svg>
    </Box>
  )
}

export default ArchitectureDiagram
