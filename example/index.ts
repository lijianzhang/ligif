import Gif from '../src/gif';

document.getElementById('main').addEventListener('drop', function (e) {
    e.stopPropagation();
    e.preventDefault();
    const field = e.dataTransfer.files[0];
    const gif = new Gif();
    gif.readData(field).then(gif => {
        gif.frames.forEach(f => document.body.appendChild(f.renderToCanvas().canvas));
    });
});
document.getElementById('main').addEventListener('dragover', function(e) {
    e.stopPropagation();
    e.preventDefault();
});