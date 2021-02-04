package main

import (
	"bytes"
	"compress/lzw"
	"fmt"
	"image/gif"
	"io"
	"reflect"
	"syscall/js"
)

func main() {
	c := make(chan int, 0)
	js.Global().Set("lzwDecode", js.FuncOf(lzwDecode))
	js.Global().Set("decodeToPixels", js.FuncOf(decodeToPixels))
	js.Global().Set("lzwEncode", js.FuncOf(lzwEncode))
	js.Global().Set("optimizePixels", js.FuncOf(optimizePixels))
	js.Global().Set("decodeGif", js.FuncOf(func(this js.Value, args []js.Value) interface{} {
		jsValue := args[0]
		return toJSValue(decodeGif(toBytes(jsValue)))
	}))
	<-c
}

func toBytes(v js.Value) []byte {
	bff := make([]byte, v.Get("byteLength").Int())
	js.CopyBytesToGo(bff, v)
	return bff
}

type GifImage struct {
	codes []byte
	x     int
	y     int
	w     int
	h     int
}

type GifImageInfo struct {
	imgs      []GifImage
	delay     []int
	loopCount int
	width     int
	height    int
}

func decodeGif(bff []byte) *GifImageInfo {
	r := bytes.NewReader(bff)

	data, err := gif.DecodeAll(r)
	if err != nil {
		return nil
	}
	imgs := make([]GifImage, 0)
	for _, img := range data.Image {
		i := make([]byte, 0)

		for y := img.Rect.Min.Y; y < img.Rect.Max.Y; y++ {
			for x := img.Rect.Min.X; x < img.Rect.Max.X; x++ {
				r, g, b, a := img.At(x, y).RGBA()
				i = append(i, byte(r>>8))
				i = append(i, byte(g>>8))
				i = append(i, byte(b>>8))
				i = append(i, byte(a>>8))
			}
		}

		imgs = append(imgs, GifImage{codes: i, x: img.Rect.Min.X, y: img.Rect.Min.Y, w: img.Rect.Dx(), h: img.Rect.Dy()})
	}

	return &GifImageInfo{imgs: imgs, delay: data.Delay, loopCount: data.LoopCount, width: data.Config.Width, height: data.Config.Height}
}

func decodeToPixels(this js.Value, args []js.Value) interface{} {

	jsValue := args[0]

	colorDeep := args[1].Get("colorDepth").Int()
	transparentColorIndex := args[1].Get("transparentColorIndex").Int()

	isInterlace := args[1].Get("isInterlace").Bool()

	palette := toBytes(args[1].Get("palette"))

	width := args[1].Get("w").Int()

	height := args[1].Get("h").Int()

	bff := toBytes(jsValue)

	dst := bytes.NewBuffer(nil)
	r := lzw.NewReader(bytes.NewReader(bff), lzw.LSB, colorDeep)
	io.Copy(dst, r)
	r.Close()
	codes := dst.Bytes()
	pixels := make([]byte, len(codes)*4)

	if !isInterlace {

		for i, code := range codes {
			if int(code) != transparentColorIndex {
				pixels[i*4] = palette[int(code)*3]
				pixels[i*4+1] = palette[int(code)*3+1]
				pixels[i*4+2] = palette[int(code)*3+2]
				pixels[i*4+3] = 255
			}
		}

	} else {

		start := [4]int{0, 4, 2, 1}
		inc := [4]int{8, 8, 4, 2}
		index := 0
		for pass := 0; pass < 4; pass++ {
			// from https://juejin.im/entry/59cc6fa151882550b3549bce
			for i := start[pass]; i < height; i += inc[pass] {
				for j := 0; j < width; j++ {
					idx := i*width*4 + j*4
					k := codes[index]
					pixels[idx] = palette[int(k)*3]
					pixels[idx+1] = palette[int(k)*3+1]
					pixels[idx+2] = palette[int(k)*3+2]
					if int(k) == transparentColorIndex {
						pixels[idx+3] = 0
					} else {
						pixels[idx+3] = 255
					}
					index++
				}
			}
		}
	}

	return toJSValue(pixels)
}

func lzwDecode(this js.Value, args []js.Value) interface{} {
	jsValue := args[0]
	colorDeep := args[1].Int()
	bff := make([]byte, jsValue.Get("byteLength").Int())
	js.CopyBytesToGo(bff, jsValue)
	dst := bytes.NewBuffer(nil)
	r := lzw.NewReader(bytes.NewReader(bff), lzw.LSB, colorDeep)
	defer r.Close()
	io.Copy(dst, r)
	return toJSValue(dst.Bytes())
}

func lzwEncode(this js.Value, args []js.Value) interface{} {

	jsValue := args[0]
	colorDeep := args[1].Int()
	bff := make([]byte, jsValue.Get("byteLength").Int())
	js.CopyBytesToGo(bff, jsValue)
	dst := bytes.NewBuffer(nil)
	r := lzw.NewWriter(dst, lzw.LSB, colorDeep)
	r.Write(bff)
	r.Close()
	return toJSValue(dst.Bytes())
}

func toJSValue(goValue interface{}) (v js.Value) {
	if reflect.TypeOf(goValue).Kind() == reflect.Ptr {
		v = toJSValue(reflect.ValueOf(goValue).Elem().Interface())
		return
	}
	switch goValue := goValue.(type) {
	case map[string]interface{}:
		v = js.Global().Get("Object").New()
		for k, value := range goValue {
			v.Set(k, toJSValue(value))
		}
		return
	case []byte:
		v = js.Global().Get("Uint8Array").New(len(goValue))
		js.CopyBytesToJS(v, goValue)
	case []int:
		v = js.Global().Get("Array").New(len(goValue))
		for i, s := range goValue {
			v.SetIndex(i, toJSValue(s))
		}
	case []string:
		v = js.Global().Get("Array").New(len(goValue))
		for i, s := range goValue {
			v.SetIndex(i, toJSValue(s))
		}
	case []interface{}:
		v = js.Global().Get("Array").New(len(goValue))
		for i, s := range goValue {
			v.SetIndex(i, toJSValue(s))
		}
		return v
	case nil, bool, int, int8, int16, int32, int64, uint, uint16, uint32, uint64, uintptr, float32, float64, string:
		v = js.ValueOf(goValue)
	default:
		t := reflect.TypeOf(goValue)
		value := reflect.ValueOf(goValue)
		if t.Kind() == reflect.Slice || t.Kind() == reflect.Array {
			n := value.Len()
			v = js.Global().Get("Array").New()
			for i := 0; i < n; i++ {
				if value.Index(i).IsValid() {
					v.SetIndex(i, toJSValue(value.Index(i).Interface()))
				}
			}
			return
		}

		if t.Kind() == reflect.Ptr {
			t = t.Elem()
			value = value.Elem()
		}

		v = js.Global().Get("Object").New()

		if t.Kind() == reflect.Struct {
			for i := 0; i < t.NumField(); i++ {
				v.Set(t.Field(i).Name, toJSValue(value.Field(i).Interface()))
			}
		} else if t.Kind() == reflect.Map {
			iter := value.MapRange()
			for iter.Next() {
				v.Set(iter.Key().String(), iter.Value())
			}
			return
		} else {
			if t.Kind() == reflect.Interface {
				v = js.Null()
			}
			fmt.Println("unknow type", t.Kind())
		}

	}
	return
}
