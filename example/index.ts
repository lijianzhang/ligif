import { GIFDecoder, GIFEncoder } from '../src';

document.getElementById('main').addEventListener('drop', function (e) {
    e.stopPropagation();
    e.preventDefault();

    const field = e.dataTransfer.files[0];
    const gif = new GIFDecoder();
    gif.readData(field).then(gif => {
       gif.frames.forEach(f =>  f.renderToCanvas().canvas);
        setTimeout(() => {
            const gIFEncoder = new GIFEncoder(gif.frames[0].w, gif.frames[0].h, 1);
            gIFEncoder.addFrames(gif.frames);



            gIFEncoder.encode().then(() => {
                const img = document.createElement('img');
                img.src = URL.createObjectURL(gIFEncoder.toBlob());
                document.body.appendChild(img);
                const b = new GIFDecoder();
                b.readCodes(gIFEncoder.codes).then(() => {
                    b.frames.forEach(f => document.body.appendChild(f.renderToCanvas().canvas));
                })
            });
        })

    });
});
document.getElementById('main').addEventListener('dragover', function(e) {
    e.stopPropagation();
    e.preventDefault();
});

const img1 = document.getElementById('img1') as HTMLImageElement;
const img2 = document.getElementById('img2') as HTMLImageElement;
const img3 = document.getElementById('img3') as HTMLImageElement;

const encoder = new GIFEncoder(img1.width, img1.height, 10);
encoder.addFrame({ img: img1, delay: 1000 });
encoder.addFrame({ img: img2, delay: 1000 });
encoder.addFrame({ img: img3, delay: 1000 });

encoder.encode().then(() => {
    const img = document.createElement('img');
    img.src = URL.createObjectURL(encoder.toBlob());
    document.body.appendChild(img);
});


