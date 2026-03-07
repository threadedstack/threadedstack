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
}
type PathDef = { id: string; path: string }

const nodes: NodeDef[] = [
  {
    id: 'client',
    label: 'Client',
    desc: 'Your app or API consumer',
    x: 210,
    y: 10,
    w: 120,
    h: 36,
  },
  {
    id: 'proxy',
    label: 'Auth Proxy',
    desc: 'Validates JWTs and API keys',
    x: 210,
    y: 76,
    w: 120,
    h: 36,
  },
  {
    id: 'secrets',
    label: 'Secrets',
    desc: 'Encrypted credential vault',
    x: 32,
    y: 242,
    w: 104,
    h: 36,
  },
  {
    id: 'threads',
    label: 'Threads',
    desc: 'Conversation memory & history',
    x: 218,
    y: 242,
    w: 104,
    h: 36,
  },
  {
    id: 'tools',
    label: 'Tools',
    desc: 'Serverless functions & proxies',
    x: 404,
    y: 242,
    w: 104,
    h: 36,
  },
]

const backendNode: NodeDef = {
  id: 'backend',
  label: 'Backend',
  desc: 'Core API — orchestrates all services',
  x: 195,
  y: 150,
  w: 150,
  h: 42,
}
const agentNode: NodeDef = {
  id: 'agent',
  label: 'AI Agent',
  desc: 'Runs in an isolated sandbox',
  x: 180,
  y: 332,
  w: 180,
  h: 50,
}

const allNodes = [...nodes, backendNode, agentNode]

/* Request flow: Client → Proxy → Backend */
const flowPaths: PathDef[] = [
  { id: 'client-proxy', path: 'M270,46 L270,76' },
  { id: 'proxy-backend', path: 'M270,112 L270,150' },
]

/* Backend orchestrates services */
const managePaths: PathDef[] = [
  { id: 'backend-secrets', path: 'M218,192 C188,218 106,220 84,242' },
  { id: 'backend-threads', path: 'M270,192 L270,242' },
  { id: 'backend-tools', path: 'M322,192 C352,218 434,220 456,242' },
]

/* Services inject into Sandbox */
const injectPaths: PathDef[] = [
  { id: 'secrets-sandbox', path: 'M84,278 C84,300 150,314 200,332' },
  { id: 'threads-agent', path: 'M270,278 L270,332' },
  { id: 'tools-sandbox', path: 'M456,278 C456,300 390,314 340,332' },
]

const allForwardPaths = [...flowPaths, ...managePaths, ...injectPaths]

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
  const hubFill = isDark ? '#1a2540' : '#f0f4ff'
  const tooltipBg = isDark ? '#2A2F38' : '#FFFFFF'
  const tooltipBorder = isDark ? 'rgba(51,112,222,0.4)' : 'rgba(51,112,222,0.25)'
  const tooltipText = isDark ? '#CBD5E1' : '#475569'

  return (
    <Box sx={{ width: '100%', maxWidth: 580, mx: 'auto' }}>
      <svg
        viewBox='0 0 560 425'
        style={{ width: '100%', height: 'auto' }}
        role='img'
        aria-label='Threaded Stack architecture: requests flow from Client through Auth Proxy to Backend, which orchestrates Secrets, Threads, and Tools — injecting them into an isolated Sandbox where the AI Agent runs'
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
          x={50}
          y={316}
          width={420}
          height={86}
          rx={16}
          ry={16}
          fill={sandboxFill}
          stroke={sandboxStroke}
          strokeWidth={1.5}
          strokeDasharray='6 3'
        />
        <text
          x={270}
          y={398}
          textAnchor='middle'
          fill={labelColor}
          fontSize={9}
          fontFamily='Ubuntu, sans-serif'
          fontWeight={500}
          letterSpacing={2}
        >
          ISOLATED SANDBOX
        </text>

        {/* Forward-flow connection lines */}
        {allForwardPaths.map((c) => (
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

        {/* Animated dots on forward paths */}
        {allForwardPaths.map((c, i) => (
          <circle
            key={`dot-${c.id}`}
            r={3}
            fill={dotColor}
            filter='url(#dotGlow)'
          >
            <animateMotion
              dur={`${2 + i * 0.3}s`}
              repeatCount='indefinite'
              path={c.path}
            />
          </circle>
        ))}

        {/* Standard nodes */}
        {nodes.map((node) => (
          <g
            key={node.id}
            className='arch-node'
            style={{ cursor: 'pointer' }}
            onMouseEnter={() => onEnter(node.id)}
            onMouseLeave={onLeave}
          >
            <rect
              x={node.x - 4}
              y={node.y - 4}
              width={node.w + 8}
              height={node.h + 8}
              rx={14}
              ry={14}
              fill={glowColor}
              style={{ animation: 'nodePulse 3s ease-in-out infinite' }}
            />
            <rect
              className='hover-glow'
              x={node.x - 6}
              y={node.y - 6}
              width={node.w + 12}
              height={node.h + 12}
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
              rx={10}
              ry={10}
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
              fontSize={11}
              fontFamily='Ubuntu, sans-serif'
              fontWeight={600}
            >
              {node.label}
            </text>
          </g>
        ))}

        {/* Backend hub node (highlighted as orchestrator) */}
        <g
          className='arch-node'
          style={{ cursor: 'pointer' }}
          onMouseEnter={() => onEnter(backendNode.id)}
          onMouseLeave={onLeave}
        >
          <rect
            x={backendNode.x - 4}
            y={backendNode.y - 4}
            width={backendNode.w + 8}
            height={backendNode.h + 8}
            rx={14}
            ry={14}
            fill={glowColor}
            style={{ animation: 'nodePulse 3s ease-in-out infinite' }}
          />
          <rect
            className='hover-glow'
            x={backendNode.x - 6}
            y={backendNode.y - 6}
            width={backendNode.w + 12}
            height={backendNode.h + 12}
            rx={16}
            ry={16}
            fill='none'
            stroke={primary}
            strokeWidth={1}
            strokeOpacity={0.4}
          />
          <rect
            className='node-border'
            x={backendNode.x}
            y={backendNode.y}
            width={backendNode.w}
            height={backendNode.h}
            rx={10}
            ry={10}
            fill={hubFill}
            stroke={isDark ? 'rgba(51,112,222,0.6)' : 'rgba(51,112,222,0.4)'}
            strokeWidth={2}
            filter='url(#nodeGlow)'
            style={{ transition: 'stroke-width 0.2s' }}
          />
          <text
            x={backendNode.x + backendNode.w / 2}
            y={backendNode.y + backendNode.h / 2 + 1}
            textAnchor='middle'
            dominantBaseline='middle'
            fill={textColor}
            fontSize={12}
            fontFamily='Ubuntu, sans-serif'
            fontWeight={700}
          >
            {backendNode.label}
          </text>
        </g>

        {/* AI Agent node (inside sandbox, prominent) */}
        <g
          className='arch-node'
          style={{ cursor: 'pointer' }}
          onMouseEnter={() => onEnter(agentNode.id)}
          onMouseLeave={onLeave}
        >
          <rect
            x={agentNode.x - 4}
            y={agentNode.y - 4}
            width={agentNode.w + 8}
            height={agentNode.h + 8}
            rx={14}
            ry={14}
            fill={isDark ? 'rgba(51,112,222,0.2)' : 'rgba(51,112,222,0.1)'}
            style={{ animation: 'nodePulse 3s ease-in-out infinite' }}
          />
          <rect
            className='hover-glow'
            x={agentNode.x - 6}
            y={agentNode.y - 6}
            width={agentNode.w + 12}
            height={agentNode.h + 12}
            rx={16}
            ry={16}
            fill='none'
            stroke={primary}
            strokeWidth={1}
            strokeOpacity={0.4}
          />
          <rect
            className='node-border'
            x={agentNode.x}
            y={agentNode.y}
            width={agentNode.w}
            height={agentNode.h}
            rx={10}
            ry={10}
            fill={nodeFill}
            stroke={isDark ? 'rgba(51,112,222,0.7)' : 'rgba(51,112,222,0.5)'}
            strokeWidth={2}
            filter='url(#nodeGlow)'
            style={{ transition: 'stroke-width 0.2s' }}
          />
          <text
            x={agentNode.x + agentNode.w / 2}
            y={agentNode.y + agentNode.h / 2 + 1}
            textAnchor='middle'
            dominantBaseline='middle'
            fill={primary}
            fontSize={12}
            fontFamily='Ubuntu, sans-serif'
            fontWeight={700}
          >
            {agentNode.label}
          </text>
        </g>

        {/* Tooltip rendered via foreignObject */}
        {hoveredNode &&
          (() => {
            const node = allNodes.find((n) => n.id === hoveredNode)
            if (!node) return null
            const tx = node.x + node.w / 2
            const tipW = 200
            const tipH = 28
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
                    background: tooltipBg,
                    border: `1px solid ${tooltipBorder}`,
                    borderRadius: 6,
                    padding: '4px 10px',
                    fontFamily: 'Ubuntu, sans-serif',
                    fontSize: 11,
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
