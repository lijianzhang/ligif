<template>
    <a-tabs type="card">
        <a-tab-pane key="1" tab="解析GIF">
            <a-spin :spinning="isLoading" title="解析中...">
                <div>
                    <a-upload-dragger name="file" :before-upload="upload" :show-upload-list="false">
                        <p class="ant-upload-drag-icon">
                            <inbox-outlined />
                        </p>
                        <p class="ant-upload-text">点击或者拖拽到该区域</p>
                    </a-upload-dragger>

                    <div class="img-list" ref="imgList"></div>
                </div>
            </a-spin>
        </a-tab-pane>
        <a-tab-pane key="2" tab="压缩GIF">
            <a-spin :spinning="isLoading" title="解析中...">
                <div>
                    <a-upload-dragger name="file" :before-upload="upload2" :show-upload-list="false">
                        <p class="ant-upload-drag-icon">
                            <inbox-outlined />
                        </p>
                        <p class="ant-upload-text">点击或者拖拽到该区域</p>
                    </a-upload-dragger>
                    <div class="img-list" ref="imgList2">
                        <img :src="originUrl" v-if="originUrl">
                        <img :src="gifUrl" v-if="gifUrl">
                    </div>
                </div>
            </a-spin>
        </a-tab-pane>
        <a-tab-pane key="3" tab="视频转GIF">
            <a-spin :spinning="isLoading" title="解析中...">
                <div>
                    <a-upload-dragger name="file" :before-upload="upload3" :show-upload-list="false">
                        <p class="ant-upload-drag-icon">
                            <inbox-outlined />
                        </p>
                        <p class="ant-upload-text">点击或者拖拽到该区域</p>
                    </a-upload-dragger>
                    <div class="img-list" ref="imgList2">
                        <img :src="videoGifUrl" v-if="videoGifUrl">
                    </div>
                </div>
            </a-spin>
        </a-tab-pane>
    </a-tabs>
</template>
<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { GIFDecoder, GIFEncoder } from '../../src/main';
import { InboxOutlined } from '@ant-design/icons-vue';

const imgList = ref<HTMLElement>(null);
const imgList2 = ref<HTMLElement>(null);
const isLoading = ref(false);

const originUrl = ref<string>(null);
const gifUrl = ref<string>(null);
const videoGifUrl = ref<string>(null)

const upload = async (file) => {
    const decoder = new GIFDecoder();
    isLoading.value = true;
    console.time('parse')
    decoder.readData(file).then((gif) => {
        imgList.value.innerHTML = '';
        gif.frames.forEach((f) => {
            const url = f.renderToCanvas().canvas.toDataURL('png', 100);
            // const url = URL.createObjectURL(new Blob([f.pixels]))
            const img = document.createElement('img');
            img.src = url;
            imgList.value.appendChild(img)
            });
        isLoading.value = false;
        console.timeEnd('parse')
    });
    return false;
};

const upload2 = async (file: File) => {
    const decoder = new GIFDecoder();
    originUrl.value = URL.createObjectURL(file);
    isLoading.value = true;
    const gif = await decoder.readData(file);
    const width = gif.width;
    const zoom = gif.width / width;
    const gIFEncoder = new GIFEncoder(width, gif.height / zoom, { colorDiff: 200 });
    (window as any).gIFEncoder = gIFEncoder;
    gIFEncoder.addFrames(gif.frames.map((f) => ({ img: f.renderToCanvas().canvas, delay: f.delay })));
    console.time('encode time');
    gIFEncoder.encode().then(() => {
        const blob = gIFEncoder.toBlob();
        gifUrl.value = URL.createObjectURL(blob);
        console.timeEnd('encode time');
        isLoading.value = false;
    });
};

const upload3 = async (file: File) => {
    const a = new GIFEncoder(320, 180);
    console.time('video time');

    a.encodeByVideo({ src: file, from: 3, to: 40, fps: 5 }).then(
        () => {
            videoGifUrl.value = URL.createObjectURL(a.toBlob());
        },
    );
}
</script>
<style>
html,
body {
    margin: 0;
    padding: 0;
}

.img-list {
    display: flex;
    flex-wrap: wrap;
}

.img-list > * {
    max-width: 25%;
    flex: 0 1 25%;
    padding: 12px;
}

#app {
    max-width: 1200px;
    padding-top: 10vh;
    margin: auto;
}
.card-container {
    background: #f5f5f5;
    overflow: hidden;
    padding: 24px;
}
.card-container > .ant-tabs-card > .ant-tabs-content {
    height: 120px;
    margin-top: -16px;
}

.card-container > .ant-tabs-card > .ant-tabs-content > .ant-tabs-tabpane {
    background: #fff;
    padding: 16px;
}

.card-container > .ant-tabs-card > .ant-tabs-bar {
    border-color: #fff;
}

.card-container > .ant-tabs-card > .ant-tabs-bar .ant-tabs-tab {
    border-color: transparent;
    background: transparent;
}

.card-container > .ant-tabs-card > .ant-tabs-bar .ant-tabs-tab-active {
    border-color: #fff;
    background: #fff;
}
</style>
