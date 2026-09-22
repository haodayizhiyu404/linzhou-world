// ═══════════════════════════════════════════════════════════
//  apps/wechat-moments.js —— 朋友圈屏：feed/发布器/个人主页/赞评
//  由 wechat.js（壳）经 window.LZWorld.Apps.wechat / WechatCore 挂接
// ═══════════════════════════════════════════════════════════
(function () {
  'use strict';
  var W = window.LZWorld, UI = W.Apps.wechat, C = W.WechatCore;


  UI.bodyMoments = function (ctx) {
    var W = ctx.W, eng = ctx.eng, userName = ctx.userName, snap = ctx.snap;
    var secM = eng.section() || {};
    var coverF = (secM.moments && secM.moments.cover) || '';
    var coverU = coverF ? W.Worldbook.imgUrl(coverF) : '';
    var uav = '';
    try { uav = eng.userAvatar(); } catch (e0) {}
    var mfeed2 = eng.momentsFeed();
    var postsHtml = '';
    for (var mi = mfeed2.length - 1; mi >= 0; mi--) postsHtml += momentsPostHtml(mfeed2[mi], mi, userName, eng, W, true, snap.dateText || '');
    body = '<div class="lzw-mfeed">' +
      '<div class="lzw-mcover">' + (coverU ? '<img src="' + C.esc(coverU) + '" alt="">' : '') +
      '<div class="lzw-mcover-shade"></div>' +
      '<div class="lzw-mme"><span class="nm">' + C.esc(userName) + '</span>' +
      (uav ? '<img class="av" src="' + C.esc(uav) + '" alt="">' : '<div class="av">' + C.esc(userName.slice(0, 1)) + '</div>') + '</div></div>' +
      '<div class="lzw-mpad"></div>' +
      (postsHtml || '<div class="lzw-sysrow" style="margin-top:44px">朋友们还没发动态<br>稍等片刻，或退出重进刷新</div>') +
      (this.mBusy ? '<div class="lzw-sysrow">朋友们正在更新…</div>' : '') +
      (this.mConfirmDel >= 0 ? '<div class="lzw-scrim"><div class="lzw-confirm">删除这条动态？<div class="lzw-cbtns"><button class="lzw-cbtn no" data-cact="mdelno">取消</button><button class="lzw-cbtn yes" data-cact="mdelok">删除</button></div></div></div>' : '') +
      '</div>';
  };

  UI.bodyMprofile = function (ctx) {
    var W = ctx.W, eng = ctx.eng, userName = ctx.userName, snap = ctx.snap;
    var pn = this.mProfile || '';
    var pc = eng.findContact(pn) || {};
    var covF2 = pc.cover || ((eng.section() || {}).moments || {}).cover || '';
    var covU2 = covF2 ? W.Worldbook.imgUrl(covF2) : '';
    // feed 只取一次、下标就地记录：沙箱桥接里 getVariables 每次返回的是副本，
    // 跨两次调用 indexOf 必然 -1——而 idx=-1 会让「UI.mMenu===idx」对所有动态恒真：
    // 进主页默认每条都弹菜单、点 ⋯ 切换失灵
    var feedAll = eng.momentsFeed();
    var hisIdx = [];
    for (var fi2 = feedAll.length - 1; fi2 >= 0 && hisIdx.length < 5; fi2--) {
      if (feedAll[fi2].who === pn) hisIdx.push(fi2);
    }
    var hisHtml = '';
    for (var hi2 = 0; hi2 < hisIdx.length; hi2++) hisHtml += momentsPostHtml(feedAll[hisIdx[hi2]], hisIdx[hi2], userName, eng, W, false, snap.dateText || '');
    body = '<div class="lzw-mfeed">' +
      '<div class="lzw-mcover">' + (covU2 ? '<img src="' + C.esc(covU2) + '" alt="">' : '') +
      '<div class="lzw-mcover-shade"></div>' +
      '<div class="lzw-mme"><span class="nm">' + C.esc(pn) + '</span>' +
      (pc.avatar ? '<img class="av" src="' + C.esc(W.Worldbook.imgUrl(pc.avatar)) + '" alt="">' : '<div class="av">' + C.esc(pn.slice(0, 1)) + '</div>') + '</div></div>' +
      '<div class="lzw-mpad"></div>' +
      (hisHtml || '<div class="lzw-sysrow" style="margin-top:36px">TA 还没有动态</div>') +
      '</div>';
  };

  // body 必须包 .lzw-body（flex:1）——否则底部横条不贴底，跟着内容跑
  UI.bodyMpost = function (ctx) {
    body = '<div class="lzw-body"><div class="lzw-mptext"><textarea class="lzw-mpta" id="lzw-mptext" maxlength="280" placeholder="这一刻的想法…"></textarea></div>' +
      '<textarea class="lzw-mpimg" id="lzw-mpimg" maxlength="60" placeholder="图片（可选）：用文字描述这张图片的画面，如：一张拍糊的试卷"></textarea></div>';
  };

  function syncMomentBar(ph) {
    var feed = ph.querySelector('.lzw-mfeed');
    var scr = ph.querySelector('.lzw-screen');
    if (!feed || !scr) return;
    var sbar = scr.querySelector('.lzw-sbar');
    var bar = scr.querySelector('.lzw-appbar-ovl');
    var cover = feed.querySelector('.lzw-mcover');
    if (!bar || !cover) return;
    var onScroll = function () {
      var p = Math.max(0, Math.min(1, feed.scrollTop / Math.max(1, cover.offsetHeight - 89)));
      var bg = 'rgba(255,255,255,' + (p * 0.97).toFixed(3) + ')';
      if (sbar) sbar.style.background = bg;
      bar.style.background = bg;
      bar.style.borderBottom = p > 0.95 ? '1px solid rgba(0,0,0,.09)' : 'none';
    };
    feed.addEventListener('scroll', onScroll);
    onScroll();
  }

  // 设置屏：生成 API（跟随正文/只换模型/自定义+可存预设）+ 提示词携带量。全部即时保存。
  UI.syncMomentBar = syncMomentBar;

  function momentsPostHtml(e, idx, userName, eng, W, feedMode, curDay) {
    var c = {};
    try { c = eng.findContact(e.who) || {}; } catch (e0) {}
    var isMine = e.who === userName;
    var mpfAttr = isMine ? '' : ' data-mpf="' + C.esc(e.who) + '"';
    var head;
    if (feedMode) {
      // 机主自己的条目：头像走机主头像，名字/头像都不挂进主页的跳转
      var avaHtml;
      if (isMine) {
        var myAv = '';
        try { myAv = eng.userAvatar(); } catch (e1) {}
        avaHtml = myAv
          ? '<img class="lzw-post-ava" src="' + C.esc(myAv) + '" alt="">'
          : '<div class="lzw-post-ava">' + C.esc(e.who.slice(0, 1)) + '</div>';
      } else {
        avaHtml = c.avatar
          ? '<img class="lzw-post-ava" src="' + C.esc(W.Worldbook.imgUrl(c.avatar)) + '"' + mpfAttr + ' alt="">'
          : '<div class="lzw-post-ava"' + mpfAttr + '>' + C.esc(e.who.slice(0, 1)) + '</div>';
      }
      head = avaHtml +
        '<div class="lzw-post-main"><div class="lzw-post-name"' + mpfAttr + '>' + C.esc(e.who) + '</div>';
    } else {
      // 主页时间戳：与 feed 同源自 pt（动态自身时间），两边永远不会再打架
      head = '<div class="lzw-post-stamp">' + C.stampParts(e.pt, e.label, curDay) + '</div><div class="lzw-post-main">';
    }
    var liked = (e.likes || []).indexOf(userName) !== -1;
    var menu = UI.mMenu === idx
      ? '<div class="lzw-pmenu">' + (isMine ? '' : '<button data-mlike="' + idx + '">' + (liked ? C.ICON_HEART_F + ' 取消' : C.ICON_HEART + ' 赞') + '</button>') + '<button data-mcmt="' + idx + '">' + C.ICON_BUBBLE + ' 评论</button>' + (isMine ? '<button data-mdel="' + idx + '">删除</button>' : '') + '</div>'
      : '';    var cmtbar = UI.mCmt === idx
      ? '<div class="lzw-cmtbar"><input id="lzw-cmtin" maxlength="60" placeholder="说点什么…"><button data-msend="' + idx + '">发送</button></div>'
      : '';
    var likeRow = (e.likes && e.likes.length)
      ? '<div class="lzw-plike">❤ ' + e.likes.map(C.esc).join('、') + '</div>'
      : '';
    var cmtRows = (e.comments || []).map(function (cm) {
      return '<div><span class="n">' + C.esc(cm.who) + '</span>' +
        (cm.replyTo ? ' 回复 <span class="n">' + C.esc(cm.replyTo) + '</span>' : '') +
        '<span class="cs">:</span><span class="c">' + C.esc(cm.text) + '</span></div>';
    }).join('');
    var cmtBlock = cmtRows ? '<div class="lzw-pcmts">' + cmtRows + '</div>' : '';
    return '<div class="lzw-post">' + head +
      '<div class="lzw-post-text">' + C.esc(e.text) + '</div>' +
      (e.img ? '<div class="lzw-post-img">' + C.esc(e.img) + '</div>' : '') +
      '<div class="lzw-post-meta">' + (feedMode ? '<span>' + C.esc(C.momentLabel(e.pt, e.label, curDay)) + '</span>' : '') + '<span class="sp"></span>' +
      menu +
      '<button class="lzw-post-more" data-mmenu="' + idx + '">⋯</button></div>' +
      likeRow + cmtBlock + cmtbar +
      '</div></div>';
  }

  // [+] 面板内容

  // 弹窗留在原地刷新徽标，不碰手机——手机开不开由玩家自己决定。
  Object.assign(UI, {
    openMoments: function () {
      var W = window.LZWorld;
      this.tab = 'discover';
      this.screen = 'moments';
      this.mMenu = -1;
      this.mCmt = -1;
      try { W.Store.clearUnread(W.Engine.momentsKey); } catch (e) {}
      this.render();
      this.momentsEnsureFresh();
    },
    // 每个故事日首次进入生成 3~4 条动态；生成完若还在朋友圈页就刷新
    // 已生成 / 状态栏日期缺失都不静默跳过：前者由引擎 filledDay 判重，后者兜底生成一次并提示
    momentsEnsureFresh: function () {
      if (this.mBusy) return;
      var eng = window.LZWorld.Engine;
      var stamp = null;
      try { stamp = window.LZWorld.Status.snapshot(null); } catch (e) {}
      if (!(stamp && stamp.dateText)) {
        console.warn('[霖州引擎] 朋友圈：最近 6 层未解析到 <status> 里的 <环境> 日期，按无日期兜底生成一次');
        try { toastr.warning('未解析到状态栏日期，朋友圈已按无日期生成；检查最近楼层的状态栏 <环境> 块', '霖州手机', { timeOut: 6000 }); } catch (e) {}
      }
      this.mBusy = true;
      this.render();
      var self = this;
      eng.momentsEnsure().then(function (got) {
        if (got) try { toastr.info('📱 朋友们更新了朋友圈', '霖州手机', { timeOut: 3000 }); } catch (e) {}
      }).catch(function (e) {
        console.warn('[霖州引擎] 朋友圈填充失败', e);
        try { toastr.error('朋友圈加载失败：' + (e && e.message || e), '霖州手机'); } catch (e2) {}
      }).finally(function () {
        self.mBusy = false;
        if (self.screen === 'moments') self.render();
      });
    },
    // 赞：纯本地往返
    momentsLike: function (idx) {
      try { window.LZWorld.Engine.momentsLike(idx); } catch (e) {}
      this.mMenu = -1;
      this.render();
    },
    // 删自己的动态：下标移位会让 mMenu/mCmt 指向别的条目，一并复位再渲染
    momentsDeleteAt: function (idx) {
      try { window.LZWorld.Engine.momentsDelete(idx); } catch (e) {}
      this.mMenu = -1;
      this.mCmt = -1;
      this.render();
    },
    // 评论：先落库，接话生成完若还在朋友圈页就刷新（不在场时红点由引擎挂）
    momentsSendComment: function (idx, text) {
      var eng = window.LZWorld.Engine;
      this.mCmt = -1;
      this.mBusy = true;
      this.render();
      var self = this;
      eng.momentsComment(idx, text).catch(function (e) {
        console.warn('[霖州引擎] 朋友圈评论失败', e);
        try { toastr.error('评论发送失败：' + (e && e.message || e), '霖州手机'); } catch (e2) {}
      }).finally(function () {
        self.mBusy = false;
        if (self.screen === 'moments' || self.screen === 'mprofile') self.render();
      });
    },

    // 选线弹窗：居中菜单，独立于手机壳——古代线没有手机也要能由此换回现代线
  });


  UI._binders.push(function (ph) {
    // 朋友圈：相机打开发布器、头像/名字进主页、⋯菜单、赞、评论、发送
    ph.querySelectorAll('[data-mcam]').forEach(function (el) {
      el.onclick = function () { UI.screen = 'mpost'; UI.mFrom = 'moments'; UI.render(); };
    });
    ph.querySelectorAll('[data-mpost-send]').forEach(function (el) {
      el.onclick = function () {
        var ta = pdoc().getElementById('lzw-mptext');
        var t = ta ? ta.value.trim() : '';
        if (!t) { try { toastr.info('写点什么再发表吧', '霖州手机'); } catch (e) {} return; }
        var im = pdoc().getElementById('lzw-mpimg');
        var img = im ? im.value.trim().slice(0, 60) : '';
        var W = window.LZWorld, eng = W.Engine;
        var idx = eng.momentsPost(t, img);
        if (idx < 0) return;
        UI.screen = 'moments';
        UI.render();
        // 朋友们的反应后台生成：落地时人在朋友圈就直接重渲染，不在就挂发现页红点
        eng.momentsReact(idx);
      };
    });
    ph.querySelectorAll('[data-mpf]').forEach(function (el) {
      el.onclick = function (ev) {
        ev.stopPropagation();
        UI.mProfile = el.dataset.mpf;
        UI.mFrom = el.dataset.mfrom || 'moments';
        UI.mMenu = -1;
        UI.mCmt = -1;
        UI.screen = 'mprofile';
        UI.render();
      };
    });
    ph.querySelectorAll('[data-mmenu]').forEach(function (el) {
      el.onclick = function (ev) {
        ev.stopPropagation();
        var i = parseInt(el.dataset.mmenu, 10);
        UI.mMenu = UI.mMenu === i ? -1 : i;
        UI.mCmt = -1;
        UI.render();
        // 点菜单外任意处收起（当前这次点击不生效，所以延迟挂监听）
        // 注意必须挂在 pdoc()（父页文档）——手机 UI 注入在父页，挂在沙箱自己的
        // document 上永远收不到点击，「点空白收起」会表现为完全失灵
        if (UI.mMenu !== -1) {
          setTimeout(function () {
            var doc = pdoc();
            doc.addEventListener('click', function onDocTap(ev2) {
              if (ev2.target.closest && (ev2.target.closest('.lzw-pmenu') || ev2.target.closest('[data-mmenu]'))) return;
              doc.removeEventListener('click', onDocTap);
              UI.mMenu = -1;
              UI.mCmt = -1;
              if (UI.screen === 'moments' || UI.screen === 'mprofile') UI.render();
            });
          }, 0);
        }
      };
    });
    ph.querySelectorAll('[data-mlike]').forEach(function (el) {
      el.onclick = function () { UI.momentsLike(parseInt(el.dataset.mlike, 10)); };
    });
    ph.querySelectorAll('[data-mcmt]').forEach(function (el) {
      el.onclick = function () {
        UI.mMenu = -1;
        UI.mCmt = parseInt(el.dataset.mcmt, 10);
        UI.render();
        var ci = ph.querySelector('#lzw-cmtin');
        if (ci) ci.focus();
      };
    });
    ph.querySelectorAll('[data-mdel]').forEach(function (el) {
      el.onclick = function () {
        UI.mMenu = -1;
        UI.mConfirmDel = parseInt(el.dataset.mdel, 10);
        UI.render();
      };
    });
    ph.querySelectorAll('[data-msend]').forEach(function (el) {
      el.onclick = function () {
        var ci = ph.querySelector('#lzw-cmtin');
        var t = ci ? ci.value.trim() : '';
        if (!t) return;
        UI.momentsSendComment(parseInt(el.dataset.msend, 10), t);
      };
    });
  });
})();
