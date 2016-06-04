/**
 * 轮播图
 * @author  wangming@lianjia.com
 */
// var hammer = require('/common/hammer');

var swiper = function (options) {
	var defaults = {
		selector: '[data-mark="swiper"]',
		imgScroll: '[data-mark="imgScroll"]',
		img: '[data-mark="img"]',
		dot: '[data-mark="dot"]',
		activeIndex: 0
	};
	var options = options || {};
	this.config = $.extend(defaults, options);
	this.activeIndex = this.config.activeIndex;
	this.init();
};

swiper.prototype = {
	isLock: false,
	elX: 0,
	extX: 0,
	diffX: 0,
	//初始化
	init: function () {
		this.render();
		return this;
	},
	loadImg: function (item) {
		var cfg = this.config;
		var item = $(item);
		var oldSrc = item.attr('src');
		var newSrc = item.attr('data-src');
		if (newSrc === undefined || newSrc === '') return;
		if (newSrc === oldSrc) return;
		var _reload = new Image(),
			_$reload = $(_reload);
		_$reload.attr('src', newSrc);
		_$reload.on('error', function () {
			item.attr('src', cfg.error);
		});
		_$reload.on('load', function () {
			item.attr('src', newSrc);
		});
	},
	//渲染html
	render: function () {
		var _this = this;
		var cfg = this.config;

		_this.container = $(cfg.selector).eq(0);
		_this.scrollbar = $(cfg.imgScroll).eq(0);
		_this.imgLists = $(cfg.img);

		_this.len = _this.container.find(cfg.img).size();
		_this.scrollbar.css('width', _this.len * 100 + '%');
		var dotTpl = '';
		if (_this.len < 1) return;
		if (_this.len == 1) {
			_this.loadImg(_this.container.find('img').eq(0));
			return;
		}
		for (var i = 0; i < _this.len; i++) {
			if (i === cfg.activeIndex) {
				dotTpl += '<li class="dot active" data-mark="dot"></li>';
			} else {
				dotTpl += '<li class="dot" data-mark="dot"></li>';
			}
			while (i == _this.len - 1) {
				var dotLists = $('<ul class="dot-list"></ul>').html(dotTpl).appendTo(_this.container);
				_this.dotLists = dotLists.find('[data-mark="dot"]');

				_this.bind();
				break;
			}
		}

		//加载图片
		var curLoader = _this.container.find('img').eq(cfg.activeIndex);
		_this.loadImg(curLoader);
	},
	//下一个
	next: function () {
		var cfg = this.config;
		var nextIndex = this.activeIndex + 1;
		nextIndex = nextIndex >= this.len - 1 ? (this.len - 1) : nextIndex;
		this.switchTo(nextIndex);
	},
	//上一个
	prev: function () {
		var cfg = this.config;
		var prevIndex = this.activeIndex - 1;
		prevIndex = prevIndex <= 0 ? 0 : prevIndex;
		this.switchTo(prevIndex);
	},
	//切换至指定项
	switchTo: function (index) {
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
	trigger: function (index) {
		var _this = this;
		_this.activeIndex = index;
		_this.imgLists.removeClass('active');
		_this.imgLists.eq(index).addClass('active');
		_this.dotLists.removeClass('active');
		_this.dotLists.eq(index).addClass('active');
		_this.loadImg(_this.container.find('img').eq(index));
		setTimeout(function () {
			_this.isLock = false;
		}, 1000);
	},
	addAni: function () {
		this.scrollbar.css({
			'-webkit-transition': '-webkit-transform .5s ease',
			'transition': 'transform .5s ease'
		});
	},
	removeAni: function () {
		this.scrollbar.css({
			'-webkit-transition': 'none',
			'transition': 'none'
		});
	},
	startHandle: function (event) {
		event.preventDefault();
		diffX = 0;
		var touch = event.touches[0];
		elX = parseInt(this.scrollbar.css('transform').replace(/^translate3d\(/img, '').replace(/\)/, '').split(',')[0]) || 0;
		evtX = touch.pageX;
	},
	moveHandle: function (event) {
		event.preventDefault();
		this.removeAni();
		var touch = event.touches[0];
		diffX = (touch.pageX - evtX);
		var moveX = elX + diffX;
		this.scrollbar.css({
			'-webkit-transform': 'translate3d(' + moveX + 'px,0,0)',
			'transform': 'translate3d(' + moveX + 'px, 0, 0)'
		});
	},
	endHandle: function (event) {
		event.preventDefault();
		this.addAni();
		var boundary = this.container.width() / 2;
		if (diffX <= -boundary) {
			this.next();
		} else if (diffX >= boundary) {
			this.prev();
		} else {
			this.switchTo(this.activeIndex);
		}
	},
	//绑定事件
	bind: function () {
		var _this = this;
		var cfg = _this.config;
		// $(document).on('click', '[data-mark="dot"]', function (event) {
		// 	var target = $(event.target);
		// 	var index = target.index();
		// 	_this.switchTo(index);
		// });

		// var myHammer = new Hammer.Manager(_this.scrollbar[0]);
		// var Swipe = new Hammer.Swipe();
		// myHammer.add(Swipe);
		
		_this.scrollbar.on('swipeLeft', function (event) {
			event.preventDefault();
			_this.addAni();
			_this.next();
		});
		_this.scrollbar.on('swipeRight', function (event) {
			event.preventDefault();
			_this.addAni();
			_this.prev();
		});

		//跟随拖拽
		$(document).on('touchstart', cfg.imgScroll, function (event) {
			_this.startHandle(event);
		});
		$(document).on('touchmove', cfg.imgScroll, function (event) {
			_this.moveHandle(event);
		});
		$(document).on('touchend', cfg.imgScroll, function (event) {
			_this.endHandle(event);
		});

	}
};

var ljmSwiper = function (config) {
	return new swiper(config);
}

exports.ljmSwiper = ljmSwiper;
