import Gif from '../src/gif';

document.getElementById('main').addEventListener('drop', function (e) {
    e.stopPropagation();
    e.preventDefault();
    const field = e.dataTransfer.files[0];
    new Gif(field);
    console.log(field);
});
document.getElementById('main').addEventListener('dragover', function(e) {
    e.stopPropagation();
    e.preventDefault();
});