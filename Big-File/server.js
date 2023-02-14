const express = require('express')
const path = require('path')
const fse = require('fs-extra')
const multiparty = require('multiparty')
const app = express()
const port = 3000
const UPLOAD_DIR = path.join(__dirname, 'target')

app.use('/', express.static(__dirname))
app.use(express.json())

app.post('/upload', (req, res) => {
  const multipart = new multiparty.Form()
  multipart.parse(req, async (err, fields, files) => {
    if (err) return

    const [chunk] = files.chunk
    const [hash] = fields.hash
    const [filename] = fields.filename
    const chunkDir = path.join(UPLOAD_DIR, filename + '_chunks')
    if (!fse.existsSync(chunkDir)) {
      await fse.mkdirs(chunkDir)
    }

    const chunkPath = `${chunkDir}/${hash}`
    if (fse.existsSync(chunkPath)) {
      res.end('chunk exists.')
    } else {
      await fse.move(chunk.path, chunkPath)
      res.end('upload success.')
    }
  })
})

const pipeStream = (path, writeStream) =>
  new Promise(resolve => {
    const readStream = fse.createReadStream(path)
    readStream.on('end', () => {
      fse.unlinkSync(path)
      resolve()
    })
    readStream.pipe(writeStream)
  })
const mergeFileChunk = async (filePath, filename, size) => {
  const chunkDir = path.resolve(UPLOAD_DIR, `${filename}_chunks`)
  const chunkPaths = await fse.readdir(chunkDir)
  chunkPaths.sort((a, b) => a.split('_')[1] - b.split('_')[1])
  await Promise.all(
    chunkPaths.map((chunkPath, index) =>
      pipeStream(
        path.resolve(chunkDir, chunkPath),
        fse.createWriteStream(filePath, { start: index * size })
      ))
  )
  fse.rmdir(chunkDir)
}
app.post('/merge', async (req, res) => {
  const { filename, size } = req.body
  const filePath = path.resolve(UPLOAD_DIR, filename)
  await mergeFileChunk(filePath, filename, size)
  res.end('merge success.')
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})