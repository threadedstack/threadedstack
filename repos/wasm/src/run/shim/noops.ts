import { noOp } from '@keg-hub/jsutils/noOp'

export const shimNoop = {
  'wasi:cli/environment': {
    getEnvironment: noOp,
    getArguments: noOp,
    initialCwd: noOp,
  },
  'wasi:cli/exit': {
    exit: noOp,
    exitWithCode: noOp,
  },
  'wasi:cli/stderr': {
    OutputStream: noOp,
    getStderr: noOp,
  },
  'wasi:cli/stdin': {
    InputStream: noOp,
    getStdin: noOp,
  },
  'wasi:cli/stdout': {
    OutputStream: noOp,
    getStdout: noOp,
  },
  'wasi:cli/terminal-input': {
    TerminalInput: noOp,
  },
  'wasi:cli/terminal-output': {
    TerminalOutput: noOp,
  },
  'wasi:cli/terminal-stderr': {
    TerminalOutput: noOp,
    getTerminalStderr: noOp,
  },
  'wasi:cli/terminal-stdin': {
    TerminalInput: noOp,
    getTerminalStdin: noOp,
  },
  'wasi:cli/terminal-stdout': {
    TerminalOutput: noOp,
    getTerminalStdout: noOp,
  },
  'wasi:sockets/instance-network': {
    instanceNetwork: noOp,
  },
  'wasi:sockets/ip-name-lookup': {
    ResolveAddressStream: noOp,
    resolveAddresses: noOp,
  },
  'wasi:sockets/network': {
    Network: noOp,
  },
  'wasi:sockets/tcp': {
    TcpSocket: noOp,
  },
  'wasi:sockets/tcp-create-socket': {
    createTcpSocket: noOp,
  },
  'wasi:sockets/udp': {
    UdpSocket: noOp,
    OutgoingDatagramStream: noOp,
    IncomingDatagramStream: noOp,
  },
  'wasi:sockets/udp-create-socket': {
    createUdpSocket: noOp,
  },
  'wasi:filesystem/preopens': {
    Descriptor: noOp,
    getDirectories: noOp,
  },
  'wasi:filesystem/types': {
    Descriptor: noOp,
    DirectoryEntryStream: noOp,
    filesystemErrorCode: noOp,
  },
  'wasi:io/error': {
    Error: noOp,
  },
  'wasi:io/poll': {
    Pollable: noOp,
    poll: noOp,
  },
  'wasi:io/streams': {
    InputStream: noOp,
    OutputStream: noOp,
  },
  'wasi:random/random': {
    getRandomBytes: noOp,
    getRandomU64: noOp,
  },
  'wasi:random/insecure': {
    getInsecureRandomBytes: noOp,
    getInsecureRandomU64: noOp,
  },
  'wasi:random/insecure-seed': {
    insecureSeed: noOp,
  },
  'wasi:clocks/monotonic-clock': {
    now: noOp,
    resolution: noOp,
    subscribeInstant: noOp,
    subscribeDuration: noOp,
  },
  'wasi:clocks/wall-clock': {
    now: noOp,
    resolution: noOp,
  },
  'wasi:http/types': {
    Fields: noOp,
    IncomingBody: noOp,
    OutgoingBody: noOp,
    RequestOptions: noOp,
    httpErrorCode: noOp,
    FutureTrailers: noOp,
    IncomingRequest: noOp,
    OutgoingRequest: noOp,
    OutgoingResponse: noOp,
    IncomingResponse: noOp,
    ResponseOutparam: noOp,
    FutureIncomingResponse: noOp,
  },
  'wasi:http/outgoing-handler': {
    handle: noOp,
  },
}
