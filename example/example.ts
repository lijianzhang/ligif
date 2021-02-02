import { GIFDecoder, GIFEncoder } from '../src/main';

(window as any).GIFEncoder = GIFEncoder;
(window as any).GIFDecoder = GIFDecoder;

function test(e) {
    e.stopPropagation();
    e.preventDefault();

    const field = e.dataTransfer.files[0];
    const gif = new GIFDecoder();
    (window as any).gif = gif;
    console.time('decode time');
    gif.readData(field).then(gif => {
        console.timeEnd('decode time');
        gif.frames.forEach(f =>
            document
                .querySelector('#imgs')
                .appendChild(f.renderToCanvas().canvas),
        );
        const width = gif.width;
        const zoom = gif.width / width;
        const gIFEncoder = new GIFEncoder(width, gif.height / zoom, { colorDiff: 1 });
        (window as any).gIFEncoder = gIFEncoder;
        gIFEncoder.addFrames(
            gif.frames.map(f => ({ img: f.ctx!.canvas, delay: f.delay })),
        );
        console.time('encode time');
        gIFEncoder.encode().then(() => {
            console.timeEnd('encode time');
            const img = document.createElement('img');
            img.src = URL.createObjectURL(gIFEncoder.toBlob());
            document
                .querySelector('#imgs')
                .insertBefore(img, document.querySelector('canvas'));
        });
    });
}

const img1 = document.getElementById('img1') as HTMLImageElement;
const img2 = document.getElementById('img2') as HTMLImageElement;
const img3 = document.getElementById('img3') as HTMLImageElement;

const encoder = new GIFEncoder(img1.width, img1.height, { time: 10, colorDiff: 10 });
encoder.addFrame({ img: img1, delay: 1000 });
encoder.addFrame({ img: img2, delay: 1000 });
encoder.addFrame({ img: img3, delay: 1000 });

encoder.encode().then(() => {
    const img = document.createElement('img');
    img.src = URL.createObjectURL(encoder.toBlob());
    document.body.appendChild(img);
});

const field = document.getElementById('file') as HTMLInputElement;
field.onchange = () => {
    const a = new GIFEncoder(320, 180);
    console.time('video time');

    a.encodeByVideo({ src: field.files[0], from: 3, to: 40, fps: 5 }).then(
        () => {
            const img = document.createElement('img');
            img.src = URL.createObjectURL(a.toBlob());
            document.body.appendChild(img);
            console.timeEnd('video time');
        },
    );
};

document.getElementById('main').addEventListener('drop', test);
document.getElementById('main').addEventListener('dragover', e => {
    e.stopPropagation();
    e.preventDefault();
});
