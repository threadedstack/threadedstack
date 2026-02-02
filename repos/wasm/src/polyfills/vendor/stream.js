// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
// Copyright Joyent and Node contributors. All rights reserved. MIT license.

import { addAbortSignal } from "./internal/streams/add-abort-signal";
import { destroyer } from "./internal/streams/destroy";
import { isDisturbed } from "./internal/streams/utils";
import { isUint8Array } from "./internal/util/types";
import { pipeline } from "./internal/streams/pipeline";
import { promisify } from "./internal/util";
import { Stream } from "./internal/streams/legacy";
import compose from "./internal/streams/compose";
import Duplex from "./internal/streams/duplex";
import eos from "./internal/streams/end-of-stream";
import PassThrough from "./internal/streams/passthrough";
import promises from "./stream/promises";
import Readable from "./internal/streams/readable";
import Transform from "./internal/streams/transform";
import Writable from "./internal/streams/writable";
import { Buffer } from "buffer";

const { custom: customPromisify } = promisify;

function _uint8ArrayToBuffer(chunk) {
    return Buffer.from(
        chunk.buffer,
        chunk.byteOffset,
        chunk.byteLength,
    );
}

Stream.isDisturbed = isDisturbed;
Stream.Readable = Readable;
Stream.Writable = Writable;
Stream.Duplex = Duplex;
Stream.Transform = Transform;
Stream.PassThrough = PassThrough;
Stream.pipeline = pipeline;
Stream.addAbortSignal = addAbortSignal;
Stream.finished = eos;
Stream.destroy = destroyer;
Stream.compose = compose;

Object.defineProperty(Stream, "promises", {
    configurable: true,
    enumerable: true,
    get() {
        return promises;
    },
});

Object.defineProperty(pipeline, customPromisify, {
    enumerable: true,
    get() {
        return promises.pipeline;
    },
});

Object.defineProperty(eos, customPromisify, {
    enumerable: true,
    get() {
        return promises.finished;
    },
});

// Backwards-compat with node 0.4.x
Stream.Stream = Stream;
Stream._isUint8Array = isUint8Array;
Stream._uint8ArrayToBuffer = _uint8ArrayToBuffer;

export default Stream;
export {
    _uint8ArrayToBuffer,
    addAbortSignal,
    compose,
    destroyer as destroy,
    Duplex,
    eos as finished,
    isDisturbed,
    isUint8Array as _isUint8Array,
    PassThrough,
    pipeline,
    Readable,
    Stream,
    Transform,
    Writable,
};