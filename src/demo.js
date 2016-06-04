var swiper = require('/common/swiper');
var imgView = require('/common/imgview');

//轮播图
var mySwiper = swiper.ljmSwiper();

//图片查看器
de.add('imgView', 'tap', function (data) {
	data.evt.preventDefault();
	var el = $(data.el);
	var index = el.parent().index();
	var arr = [];
	var original1 = data.data['original'];

	if (original1 != undefined && original1 != '') {
		arr.push(original1);
	}

	el.parent().siblings('[data-mark="img"]').each(function (i, v) {
		var source = $.queryToJson($(v).find('img').attr('data-query'))['original'];
		if (source != undefined && source != '') {
			arr.push(source);
		}
	});

	if (arr.length < 1) return;

	imgView.ljmImgView({
		data: arr,
		placeholder: '../../../images/common/loading.gif', //预加载时loading的或者默认图
		error: '../../../images/common/net_error.png', //加载图片失败显示的图片
		activeIndex: index,
		callback: function(index){      
			mySwiper.switchTo(index);
		}
	});
});