# LIGIF

支持直接在浏览器生成和解析GIF图片的工具库

### 参考资料
* 文件格式: [3MF Project: What’s In A GIF - Bit by Byte](http://www.matthewflickinger.com/lab/whatsinagif/bits_and_bytes.asp)

### Demo
[example](https://lijianzhang.github.io/ligif/example/index.html)

### Installation

```bash
yarn add ligif
```

or

```ba
npm i -S ligif
```

### Usage

**生成gif**

```javas
import { GIFEncoder } from 'ligif';
const img1 = document.getElementById('img1');
const img2 = document.getElementById('img2');
const img3 = document.getElementById('img3');

const encoder = new GIFEncoder(img1.width, img1.height);
encoder.addFrame({ img: img1 });
encoder.addFrame({ img: img2 });
encoder.addFrame({ img: img3 });

encoder.encode().then(() => {
    const img = document.createElement('img');
    img.src = URL.createObjectURL(encoder.toBlob());
    document.body.appendChild(img);
});

```



**解析gif**

```javas
import { GIFDecoder } from 'ligif';

document.getElementById('main').addEventListener('drop', function (e) {
    e.stopPropagation();
    e.preventDefault();

    const field = e.dataTransfer.files[0];
    const gif = new GIFDecoder();
    gif.readData(field).then(gif => {
       gif.frames.forEach(f => document.body.appendChild(f.renderToCanvas().canvas));
    });
});
```



### TODO

- [ ] 增加进度控制
- [ ] 耗时操作都改为worker
- [ ] 增加对video支持
- [x] 支持控制循环次数
- [ ] 支持有损压缩

### License

[MIT](http://opensource.org/licenses/MIT)