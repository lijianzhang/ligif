# GIF

### Tool library for GIF

TODO:
- [x] lzw解析
- [x] lzw压缩(还未真实测过)
- [x] gif文件格式头部解析
- [x] gif图像数据转颜色
- [x] gif文件转canvas
- [x] canvas转gif
- [x] 无损压缩时, 颜色数超过256,需转成多个调色板
- [ ] video转(canvas | blob | ArrayBuffer)
- [ ] gif有损压缩
- [x] 增加多个worker支持, 但是貌似不能复用?
- [ ] 只用全局调色板不一定生成的gif体积就小, 还要看像素使用的频率
- [ ] 帧数过多会很卡?