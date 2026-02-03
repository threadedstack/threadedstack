import type {
  _WASIImportObject,
  WASIImportObject,
  VersionedWASIImportObject,
} from '@bytecodealliance/preview2-shim/instantiation'
import { WASIShim } from '@bytecodealliance/preview2-shim/instantiation'

const wss = new WASIShim()
export const shim = wss.getImportObject() as unknown as _WASIImportObject

