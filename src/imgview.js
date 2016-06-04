/**
 * 图片查看器
 * @author  wangming@lianjia.com
 * 2016.04.23 添加懒加载/pich
 * pich部分可继续优化
 */

var layerTpl = '' +
    '<div class="imgview-wrap">' +
    '<header class="imgview-header">' +
    '<span class="imgview-back"><i class="icon icon-back">退出</i></span>' +
    '<span class="imgview-title">图片详情</span>' +
    '</header>' +
    '<div class="imgview-view">' +
    '<div class="imgview-imgbox">' +
    '<ul class="imgview-imglist">{{imgs}}</ul>' +
    '</div>' +
    '<div class="imgview-loading"></div>' +
    '</div>' +
    '<footer class="imgview-pages"><span class="imgview-currentPage">{{curPage}}</span>/<span class="imgview-countPage">{{countPage}}</span></footer>' +
    '</div>';

var sum = function(a, b) {
    return a + b;
};
var isCloseTo = function(value, expected) {
    return value > expected - 0.01 && value < expected + 0.01;
};

//探测手势
var detectGestures = function(el, target) {
    var interaction = null;
    var fingers = 0;
    var lastTouchStart = null;
    var startTouches = null;

    var setInteraction = function(newInteraction, event) {
        if (interaction !== newInteraction) {

            if (interaction && !newInteraction) {
                switch (interaction) {
                    case 'zoom':
                        target.handleZoomEnd(event);
                        break;
                    case 'drag':
                        target.handleDragEnd(event);
                        break;
                }
            }

            switch (newInteraction) {
                case 'zoom':
                    target.handleZoomStart(event);
                    break;
                case 'drag':
                    target.handleDragStart(event);
                    break;
            }
        }
        interaction = newInteraction;
    };

    var updateInteraction = function(event) {
        if (fingers === 2) {
            setInteraction('zoom');
        } else if (fingers === 1 && target.canDrag()) {
            setInteraction('drag', event);
        } else {
            setInteraction(null, event);
        }
    };

    var targetTouches = function(touches) {
        return Array.prototype.slice.call(touches).map(function(touch) {
            return {
                x: touch.pageX,
                y: touch.pageY
            };
        });
    };

    var getDistance = function(a, b) {
        var x, y;
        x = a.x - b.x;
        y = a.y - b.y;
        return Math.sqrt(x * x + y * y);
    };

    var calculateScale = function(startTouches, endTouches) {
        var startDistance = getDistance(startTouches[0], startTouches[1]),
            endDistance = getDistance(endTouches[0], endTouches[1]);
        return endDistance / startDistance;
    };

    var cancelEvent = function(event) {
        event.stopPropagation();
        event.preventDefault();
    };

    var detectDoubleTap = function(event) {
        var time = (new Date()).getTime();

        if (fingers > 1) {
            lastTouchStart = null;
        }

        if (time - lastTouchStart < 300) {
            cancelEvent(event);

            target.handleDoubleTap(event);
            switch (interaction) {
                case "zoom":
                    target.handleZoomEnd(event);
                    break;
                case 'drag':
                    target.handleDragEnd(event);
                    break;
            }
        }

        if (fingers === 1) {
            lastTouchStart = time;
        }
    };

    var firstMove = true;

    el.addEventListener('touchstart', function(event) {
        if (target.enabled) {
            firstMove = true;
            fingers = event.touches.length;
            detectDoubleTap(event);
        }
    });

    el.addEventListener('touchmove', function(event) {
        if (target.enabled) {
            if (firstMove) {
                updateInteraction(event);
                if (interaction) {
                    cancelEvent(event);
                }
                startTouches = targetTouches(event.touches);
            } else {
                switch (interaction) {
                    case 'zoom':
                        target.handleZoom(event, calculateScale(startTouches, targetTouches(event.touches)));
                        break;
                    case 'drag':
                        target.handleDrag(event);
                        break;
                }
                if (interaction) {
                    cancelEvent(event);
                    target.update();
                }
            }

            firstMove = false;
        }
    });

    el.addEventListener('touchend', function(event) {
        if (target.enabled) {
            fingers = event.touches.length;
            updateInteraction(event);
        }
    });
};

//zoom功能
var imgzoom = function(el, options) {
    this.el = $(el);
    this.zoomFactor = 1;
    this.lastScale = 1;
    this.offset = {
        x: 0,
        y: 0
    };
    this.options = $.extend({}, this.defaults, options);
    this.setupMarkup();
    this.bindEvents();
    this.update();
    this.enable();
};

imgzoom.prototype = {
    //默认参数
    defaults: {
        tapZoomFactor: 2,
        zoomOutFactor: 1.3,
        animationDuration: 300,
        maxZoom: 4,
        minZoom: 0.5,
        lockDragAxis: false,
        use2d: false,
        zoomStartEventName: 'pz_zoomstart',
        zoomEndEventName: 'pz_zoomend',
        dragStartEventName: 'pz_dragstart',
        dragEndEventName: 'pz_dragend',
        doubleTapEventName: 'pz_doubletap'
    },

    //开始拖拽
    handleDragStart: function(event) {
        this.el.trigger(this.options.dragStartEventName);
        this.stopAnimation();
        this.lastDragPosition = false;
        this.hasInteraction = true;
        this.handleDrag(event);
    },

    //拖拽
    handleDrag: function(event) {
        if (this.zoomFactor > 1) {
            var touch = this.getTouches(event)[0];
            this.drag(touch, this.lastDragPosition);
            this.offset = this.sanitizeOffset(this.offset);
            this.lastDragPosition = touch;
        }
    },

    //拖拽结束
    handleDragEnd: function() {
        this.el.trigger(this.options.dragEndEventName);
        this.end();
    },

    //开始缩放
    handleZoomStart: function(event) {
        this.el.trigger(this.options.zoomStartEventName);
        this.stopAnimation();
        this.lastScale = 1;
        this.nthZoom = 0;
        this.lastZoomCenter = false;
        this.hasInteraction = true;
    },

    //缩放
    handleZoom: function(event, newScale) {
        var touchCenter = this.getTouchCenter(this.getTouches(event));
        var scale = newScale / this.lastScale;
        this.lastScale = newScale;

        this.nthZoom += 1;
        if (this.nthZoom > 3) {
            this.scale(scale, touchCenter);
            this.drag(touchCenter, this.lastZoomCenter);
        }
        this.lastZoomCenter = touchCenter;
    },

    //缩放结束
    handleZoomEnd: function() {
        this.el.trigger(this.options.zoomEndEventName);
        this.end();
    },

    //双击放大
    handleDoubleTap: function(event) {
        var center = this.getTouches(event)[0],
            zoomFactor = this.zoomFactor > 1 ? 1 : this.options.tapZoomFactor,
            startZoomFactor = this.zoomFactor,
            updateProgress = (function(progress) {
                this.scaleTo(startZoomFactor + progress * (zoomFactor - startZoomFactor), center);
            }).bind(this);

        if (this.hasInteraction) {
            return;
        }
        if (startZoomFactor > zoomFactor) {
            center = this.getCurrentZoomCenter();
        }

        this.animate(this.options.animationDuration, updateProgress, this.swing);
        this.el.trigger(this.options.doubleTapEventName);
    },

    //处理偏移值
    sanitizeOffset: function(offset) {
        var maxX = (this.zoomFactor - 1) * this.getContainerX(),
            maxY = (this.zoomFactor - 1) * this.getContainerY(),
            maxOffsetX = Math.max(maxX, 0),
            maxOffsetY = Math.max(maxY, 0),
            minOffsetX = Math.min(maxX, 0),
            minOffsetY = Math.min(maxY, 0);

        return {
            x: Math.min(Math.max(offset.x, minOffsetX), maxOffsetX),
            y: Math.min(Math.max(offset.y, minOffsetY), maxOffsetY)
        };
    },

    //缩放到
    scaleTo: function(zoomFactor, center) {
        this.scale(zoomFactor / this.zoomFactor, center);
    },

    //缩放
    scale: function(scale, center) {
        scale = this.scaleZoomFactor(scale);
        this.addOffset({
            x: (scale - 1) * (center.x + this.offset.x),
            y: (scale - 1) * (center.y + this.offset.y)
        });
    },

    //缩放处理
    scaleZoomFactor: function(scale) {
        var originalZoomFactor = this.zoomFactor;
        this.zoomFactor *= scale;
        this.zoomFactor = Math.min(this.options.maxZoom, Math.max(this.zoomFactor, this.options.minZoom));
        return this.zoomFactor / originalZoomFactor;
    },

    //拖拽
    drag: function(center, lastCenter) {
        if (lastCenter) {
            if (this.options.lockDragAxis) {
                if (Math.abs(center.x - lastCenter.x) > Math.abs(center.y - lastCenter.y)) {
                    this.addOffset({
                        x: -(center.x - lastCenter.x),
                        y: 0
                    });
                } else {
                    this.addOffset({
                        y: -(center.y - lastCenter.y),
                        x: 0
                    });
                }
            } else {
                this.addOffset({
                    y: -(center.y - lastCenter.y),
                    x: -(center.x - lastCenter.x)
                });
            }
        }
    },

    //获取出没中心点
    getTouchCenter: function(touches) {
        return this.getVectorAvg(touches);
    },

    //获取位置
    getVectorAvg: function(vectors) {
        return {
            x: vectors.map(function(v) {
                return v.x;
            }).reduce(sum) / vectors.length,
            y: vectors.map(function(v) {
                return v.y;
            }).reduce(sum) / vectors.length
        };
    },

    //增加偏移
    addOffset: function(offset) {
        this.offset = {
            x: this.offset.x + offset.x,
            y: this.offset.y + offset.y
        };
    },

    sanitize: function() {
        if (this.zoomFactor < this.options.zoomOutFactor) {
            this.zoomOutAnimation();
        } else if (this.isInsaneOffset(this.offset)) {
            this.sanitizeOffsetAnimation();
        }
    },

    //范围判断
    isInsaneOffset: function(offset) {
        var sanitizedOffset = this.sanitizeOffset(offset);
        return sanitizedOffset.x !== offset.x ||
            sanitizedOffset.y !== offset.y;
    },

    //处理动画
    sanitizeOffsetAnimation: function() {
        var targetOffset = this.sanitizeOffset(this.offset),
            startOffset = {
                x: this.offset.x,
                y: this.offset.y
            },
            updateProgress = (function(progress) {
                this.offset.x = startOffset.x + progress * (targetOffset.x - startOffset.x);
                this.offset.y = startOffset.y + progress * (targetOffset.y - startOffset.y);
                this.update();
            }).bind(this);

        this.animate(
            this.options.animationDuration,
            updateProgress,
            this.swing
        );
    },

    //放大动画
    zoomOutAnimation: function() {
        var startZoomFactor = this.zoomFactor,
            zoomFactor = 1,
            center = this.getCurrentZoomCenter(),
            updateProgress = (function(progress) {
                this.scaleTo(startZoomFactor + progress * (zoomFactor - startZoomFactor), center);
            }).bind(this);

        this.animate(
            this.options.animationDuration,
            updateProgress,
            this.swing
        );
    },

    //更新缩放比
    updateAspectRatio: function() {
        this.setContainerY(this.getContainerX() / this.getAspectRatio());
    },

    //
    getInitialZoomFactor: function() {
        return this.container[0].offsetWidth / this.el[0].offsetWidth;
    },

    //计算元素横纵比
    getAspectRatio: function() {
        return this.el.offset().width / this.el.offset().height;
    },

    //计算当前偏移和缩放中心
    getCurrentZoomCenter: function() {
        var length = this.container[0].offsetWidth * this.zoomFactor;
        var offsetLeft = this.offset.x;
        var offsetRight = length - offsetLeft - this.container[0].offsetWidth;
        var widthOffsetRatio = offsetLeft / offsetRight;
        var centerX = widthOffsetRatio * this.container[0].offsetWidth / (widthOffsetRatio + 1);

        var height = this.container[0].offsetHeight * this.zoomFactor;
        var offsetTop = this.offset.y;
        var offsetBottom = height - offsetTop - this.container[0].offsetHeight;
        var heightOffsetRatio = offsetTop / offsetBottom;
        var centerY = heightOffsetRatio * this.container[0].offsetHeight / (heightOffsetRatio + 1);

        if (offsetRight === 0) {
            centerX = this.container[0].offsetWidth;
        }
        if (offsetBottom === 0) {
            centerY = this.container[0].offsetHeight;
        }

        return {
            x: centerX,
            y: centerY
        };
    },

    canDrag: function() {
        return !isCloseTo(this.zoomFactor, 1);
    },

    getTouches: function(event) {
        var position = this.container.offset();
        return Array.prototype.slice.call(event.touches).map(function(touch) {
            return {
                x: touch.pageX - position.left,
                y: touch.pageY - position.top
            };
        });
    },

    animate: function(duration, framefn, timefn, callback) {
        var startTime = new Date().getTime(),
            renderFrame = (function() {
                if (!this.inAnimation) {
                    return;
                }
                var frameTime = new Date().getTime() - startTime,
                    progress = frameTime / duration;
                if (frameTime >= duration) {
                    framefn(1);
                    if (callback) {
                        callback();
                    }
                    this.update();
                    this.stopAnimation();
                    this.update();
                } else {
                    if (timefn) {
                        progress = timefn(progress);
                    }
                    framefn(progress);
                    this.update();
                    requestAnimationFrame(renderFrame);
                }
            }).bind(this);
        this.inAnimation = true;
        requestAnimationFrame(renderFrame);
    },

    stopAnimation: function() {
        this.inAnimation = false;
    },

    swing: function(p) {
        return -Math.cos(p * Math.PI) / 2 + 0.5;
    },

    getContainerX: function() {
        return this.container.offset().width;
    },

    getContainerY: function() {
        return this.container.offset().height;
    },

    setContainerY: function(y) {
        return this.container.height(y);
    },

    setupMarkup: function() {
        this.container = this.el.parent();
        var owidth = this.container.offset().width;
        var ewidth = this.el.offset().width;
        var oheight = this.container.offset().height;
        var eheight = this.el.offset().height;
        var initCssText = {
            '-webkit-transform-origin': '0% -100%',
            '-moz-transform-origin': '0% -100%',
            '-ms-transform-origin': '0% -100%',
            '-o-transform-origin': '0% -100%',
            'transform-origin': '0% -100%'
        };
        if (ewidth >= eheight) {
            initCssText = $.extend(initCssText, {
                'width': '100%'
            });
        } else {
            initCssText = $.extend(initCssText, {
                'height': '100%'
            });
        }
        this.el.css(initCssText);
    },

    end: function() {
        this.hasInteraction = false;
        this.sanitize();
        this.update();
    },

    //事件绑定
    bindEvents: function() {
        detectGestures(this.container.get(0), this);
        $(window).on('resize', this.update.bind(this));
        $(this.el).find('img').on('load', this.update.bind(this));
    },

    //更新坐标
    update: function() {

        if (this.updatePlaned) {
            return;
        }
        this.updatePlaned = true;

        setTimeout((function() {
            this.updatePlaned = false;
            // this.updateAspectRatio();
            var zoomFactor = 1 * this.zoomFactor;
            var offsetX = -this.offset.x / zoomFactor;
            var offsetY = -this.offset.y / zoomFactor;

            var transform3d = 'scale3d(' + zoomFactor + ', ' + zoomFactor + ',1) translate3d(' + offsetX + 'px,' + offsetY + 'px,0px)';
            var transform2d = 'scale(' + zoomFactor + ', ' + zoomFactor + ') translate(' + offsetX + 'px,' + offsetY + 'px)';
            var removeClone = (function() {
                if (this.clone) {
                    this.clone.remove();
                    delete this.clone;
                }
            }).bind(this);

            if (!this.options.use2d || this.hasInteraction || this.inAnimation) {
                this.is3d = true;
                removeClone();
                this.el.css({
                    '-webkit-transform': transform3d,
                    '-o-transform': transform2d,
                    '-ms-transform': transform2d,
                    '-moz-transform': transform2d,
                    'transform': transform3d
                });
            } else {
                if (this.is3d) {
                    this.clone = this.el.clone();
                    this.clone.css('pointer-events', 'none');
                    this.clone.appendTo(this.container);
                    setTimeout(removeClone, 200);
                }
                this.el.css({
                    '-webkit-transform': transform2d,
                    '-o-transform': transform2d,
                    '-ms-transform': transform2d,
                    '-moz-transform': transform2d,
                    'transform': transform2d
                });
                this.is3d = false;
            }
        }).bind(this), 0);
    },

    //
    enable: function() {
        this.enabled = true;
    },

    //禁止
    disable: function() {
        this.enabled = false;
    }
};

//slide功能
var imgview = function(config) {
    var defaults = {
        data: null, //图片资源
        placeholder: null, //默认显示图片,loading
        error: null, //网络错误显示
        activeIndex: 0, //当前索引
        callback: function() {}
    };
    var config = config || {};
    this.config = $.extend(defaults, config);
    this.activeIndex = this.config.activeIndex;
    this.init();
};

imgview.prototype = {
    isLock: false,
    isScale: false,
    objSwipe: {
        elX: 0,
        elY: 0,
        extX: 0,
        extY: 0,
        diffX: 0,
        diffY: 0
    },
    //初始化
    init: function() {
        this.render();
        this.bind();
        return this;
    },
    isLoad: function(src) {
        var img = new Image();
        $(img).on('error', function() {
            return false;
        });
        $(img).on('load', function() {
            return true;
        });
    },
    loadImg: function(item) {
        var cfg = this.config;
        var item = $(item);
        var oldSrc = item.attr('src');
        var newSrc = item.attr('data-src');
        if (newSrc === undefined || newSrc === '') return;
        if (newSrc === oldSrc) return;
        var _reload = new Image();
        _$reload = $(_reload);
        _$reload.attr('src', newSrc);
        _$reload.on('error', function() {
            item.attr('src', cfg.error);
        });
        _$reload.on('load', function() {
            item.attr('src', newSrc);
            setTimeout(function() {
                new imgzoom(item, {});
            }, 0);
        });
    },
    //渲染html
    render: function() {
        var _this = this;
        var cfg = this.config;
        var len = cfg.data.length;
        var container = $('<section class="layer-fixed" ></section>').appendTo(document.body);

        var imgTpl = '';
        if (len < 1) return;
        layerTpl = layerTpl.replace('{{countPage}}', len);
        for (var i = 0; i < len; i++) {
            var imgSrc = cfg.data[i];
            // curSrc = imgSrc;
            var curSrc = _this.isLoad(imgSrc) ? imgSrc : cfg.placeholder;
            if (i == _this.activeIndex) {
                imgTpl += '<li data-index="' + i + '" class="imgview-li active">' +
                    '<img data-src="' + cfg.data[i] + '" src="' + curSrc + '" style="" />' +
                    '</li>';
                layerTpl = layerTpl.replace('{{curPage}}', _this.activeIndex + 1);
            } else {
                imgTpl += '<li data-index="' + i + '" class="imgview-li">' +
                    '<img data-src="' + cfg.data[i] + '" src="' + curSrc + '" />' +
                    '</li>';
            }
            while (i == len - 1) {
                layerTpl = layerTpl.replace('{{imgs}}', imgTpl);
                container.append(layerTpl);
                break;
            }
        }

        //加载图片
        var curLoader = container.find('img').eq(_this.activeIndex);
        _this.loadImg(curLoader);

        var DOM = {};
        DOM.li = $('.imgview-li');
        DOM.back = $('.imgview-back');
        DOM.imglist = $('.imgview-imglist');
        DOM.currentPage = $('.imgview-currentPage');
        DOM.countPage = $('.imgview-countPage');

        _this.container = container;
        _this.len = len;
        _this.DOM = DOM;
        _this.scrollbar = DOM.imglist.eq(0);
        _this.imgLists = DOM.li;

        var w = container.width();
        var move = -this.activeIndex * w;

        _this.scrollbar.css({
            'width': len * 100 + '%',
            '-webkit-transform': 'translate3d(' + move + 'px,0,0)',
            'transform': 'translate3d(' + move + 'px, 0, 0)'
        });
        _this.imgLists.css({
            'width': 100 / len + '%'
        });
    },
    //下一个
    next: function() {
        var cfg = this.config;
        var nextIndex = this.activeIndex + 1;
        nextIndex = nextIndex >= this.len - 1 ? (this.len - 1) : nextIndex;
        this.switchTo(nextIndex);
    },
    //上一个
    prev: function() {
        var cfg = this.config;
        var prevIndex = this.activeIndex - 1;
        prevIndex = prevIndex <= 0 ? 0 : prevIndex;
        this.switchTo(prevIndex);
    },
    //切换至指定项
    switchTo: function(index) {
        var _this = this;
        if (!_this.isLock) {
            var unit = _this.container.width();
            var move = parseInt(index * unit);
            _this.scrollbar.css({
                '-webkit-transform': 'translate3d(-' + move + 'px,0,0)',
                'transform': 'translate3d(-' + move + 'px, 0, 0)'
            });
            _this.trigger(index);
        }
    },
    //触发
    trigger: function(index) {
        var _this = this;
        _this.activeIndex = index;
        _this.imgLists.removeClass('active');
        _this.imgLists.eq(index).addClass('active');
        _this.loadImg(_this.container.find('img').eq(index));
        _this.DOM['currentPage'].text(index + 1);
        setTimeout(function() {
            _this.isLock = false;
        }, 1000);
    },
    addAni: function() {
        this.scrollbar.css({
            '-webkit-transition': '-webkit-transform .5s ease',
            'transition': 'transform .5s ease'
        });
    },
    removeAni: function() {
        this.scrollbar.css({
            '-webkit-transition': 'none',
            'transition': 'none'
        });
    },
    startHandle: function(event) {
        this.objSwipe.diffX = 0;
        this.objSwipe.diffY = 0;
        var touch = event.touches[0];
        this.objSwipe.elX = parseInt(this.scrollbar.css('transform').replace(/^translate3d\(/img, '').replace(/\)/, '').split(',')[0]) ||
            0;
        this.objSwipe.elY = parseInt(this.scrollbar.css('transform').replace(/^translate3d\(/img, '').replace(/\)/, '').split(',')[1]) ||
            0;
        this.objSwipe.evtX = touch.pageX;
        this.objSwipe.evtY = touch.pageY;
    },
    moveHandle: function(event) {
        event.preventDefault();
        this.removeAni();
        var touch = event.touches[0];
        this.objSwipe.diffX = (touch.pageX - this.objSwipe.evtX);
        this.objSwipe.diffY = (touch.pageY - this.objSwipe.evtY);
        var moveX = this.objSwipe.elX + this.objSwipe.diffX;
        var moveY = this.objSwipe.elY + this.objSwipe.diffY;

        this.scrollbar.css({
            '-webkit-transform': 'translate3d(' + moveX + 'px,0,0)',
            'transform': 'translate3d(' + moveX + 'px, 0, 0)'
        });
    },
    endHandle: function(event) {
        this.addAni();
        var boundary = this.container.width() / 2;
        if (this.objSwipe.diffX <= -boundary) {
            this.next();
        } else if (this.objSwipe.diffX >= boundary) {
            this.prev();
        } else {
            this.switchTo(this.activeIndex);
        }
    },
    //绑定事件
    bind: function() {
        var _this = this;
        var cfg = _this.config;

        //退出
        _this.DOM.back.on('tap', function() {
            _this.destory();
            cfg.callback && cfg.callback.call(_this, _this.activeIndex);
        });

        //swipe
        _this.scrollbar.on('swipeLeft', function() {
            // if(_this.isScale)
            // if(_this.objScale.scale > 1) return;
            _this.addAni();
            _this.next();
        });
        _this.scrollbar.on('swipeRight', function() {
            // if(_this.objScale.scale > 1) return;
            _this.addAni();
            _this.prev();
        });
        $(document).on('touchmove', '.imgview-imglist', function(event) {
            event.preventDefault();
        });
        //跟随拖拽
        $(document).on('touchstart', '.imgview-imglist', function(event) {
            var figures = event.touches.length;
            if (figures === 1) {
                // if(_this.objScale.scale > 1) return;
                _this.startHandle(event);
            }
            // } else if (figures === 2) {
            //     var curImg = $(event.target).is('li') ? $(event.target).find('.active img') : $(event.target);
            //     console.log(curImg)
            //     _this.objScale.maxScale = Math.max(curImg[0].naturalWidth / _this.container.width(), curImg[0].naturalHeight / _this.container.height());
            //     _this.startScale(event);
            // }
        });
        $(document).on('touchmove', '.imgview-imglist', function(event) {
            var figures = event.touches.length;
            if (figures === 1) {
                _this.moveHandle(event);
            }
            // } else if (figures === 2) {
            //     // _this.moveScale(event);
            // }
        });
        $(document).on('touchend', '.imgview-imglist', function(event) {
            var figures = event.touches.length;
            if (figures === 0) {
                _this.endHandle(event);
            }
            // } else if (figures === 1) {
            //     // _this.endScale(event);
            // }
        });

    },
    destory: function() {
        this.container.remove();
    }
};

exports.ljmImgView = function(config) {
    return new imgview(config);
}