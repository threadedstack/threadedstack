import { describe, it, expect } from 'vitest'
import { mimeFromPath } from './mimeFromPath'

describe(`mimeFromPath`, () => {
  it(`should return correct MIME for common text extensions`, () => {
    expect(mimeFromPath(`readme.txt`)).toBe(`text/plain`)
    expect(mimeFromPath(`index.html`)).toBe(`text/html`)
    expect(mimeFromPath(`style.css`)).toBe(`text/css`)
    expect(mimeFromPath(`data.csv`)).toBe(`text/csv`)
    expect(mimeFromPath(`notes.md`)).toBe(`text/markdown`)
  })

  it(`should return correct MIME for code files`, () => {
    expect(mimeFromPath(`app.js`)).toBe(`application/javascript`)
    expect(mimeFromPath(`app.mjs`)).toBe(`application/javascript`)
    expect(mimeFromPath(`app.ts`)).toBe(`application/typescript`)
    expect(mimeFromPath(`app.tsx`)).toBe(`application/typescript`)
    expect(mimeFromPath(`config.json`)).toBe(`application/json`)
  })

  it(`should return correct MIME for image files`, () => {
    expect(mimeFromPath(`photo.png`)).toBe(`image/png`)
    expect(mimeFromPath(`photo.jpg`)).toBe(`image/jpeg`)
    expect(mimeFromPath(`photo.jpeg`)).toBe(`image/jpeg`)
    expect(mimeFromPath(`icon.svg`)).toBe(`image/svg+xml`)
    expect(mimeFromPath(`banner.webp`)).toBe(`image/webp`)
  })

  it(`should handle paths with directories`, () => {
    expect(mimeFromPath(`src/components/App.tsx`)).toBe(`application/typescript`)
    expect(mimeFromPath(`docs/guide/README.md`)).toBe(`text/markdown`)
  })

  it(`should be case-insensitive for extensions`, () => {
    expect(mimeFromPath(`FILE.JSON`)).toBe(`application/json`)
    expect(mimeFromPath(`image.PNG`)).toBe(`image/png`)
    expect(mimeFromPath(`script.TS`)).toBe(`application/typescript`)
  })

  it(`should return correct MIME for binary/disallowed types`, () => {
    expect(mimeFromPath(`app.exe`)).toBe(`application/octet-stream`)
    expect(mimeFromPath(`archive.zip`)).toBe(`application/zip`)
    expect(mimeFromPath(`song.mp3`)).toBe(`audio/mpeg`)
    expect(mimeFromPath(`clip.mp4`)).toBe(`video/mp4`)
  })

  it(`should return correct MIME for other programming languages`, () => {
    expect(mimeFromPath(`main.py`)).toBe(`text/x-python`)
    expect(mimeFromPath(`app.go`)).toBe(`text/x-go`)
    expect(mimeFromPath(`lib.rs`)).toBe(`text/x-rust`)
    expect(mimeFromPath(`run.sh`)).toBe(`application/x-sh`)
    expect(mimeFromPath(`config.toml`)).toBe(`application/toml`)
    expect(mimeFromPath(`App.java`)).toBe(`text/x-java`)
    expect(mimeFromPath(`main.c`)).toBe(`text/x-c`)
    expect(mimeFromPath(`main.cpp`)).toBe(`text/x-c++`)
    expect(mimeFromPath(`app.rb`)).toBe(`text/x-ruby`)
  })

  it(`should return text/plain for unknown extensions`, () => {
    expect(mimeFromPath(`data.xyz`)).toBe(`text/plain`)
    expect(mimeFromPath(`data.zzz`)).toBe(`text/plain`)
  })

  it(`should return text/plain for files with no extension`, () => {
    expect(mimeFromPath(`Makefile`)).toBe(`text/plain`)
    expect(mimeFromPath(`Dockerfile`)).toBe(`text/plain`)
  })

  it(`should handle dotfiles`, () => {
    expect(mimeFromPath(`.gitignore`)).toBe(`text/plain`)
    expect(mimeFromPath(`.env`)).toBe(`text/plain`)
  })

  it(`should use the last extension for double extensions`, () => {
    expect(mimeFromPath(`file.test.ts`)).toBe(`application/typescript`)
    expect(mimeFromPath(`data.backup.json`)).toBe(`application/json`)
  })
})
