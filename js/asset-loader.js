(function(global){
  'use strict';

  var totals = { pending: 0, loaded: 0, failed: 0, recovered: 0, retries: 0, errors: 0 };

  function getStatus(){
    return Object.assign({}, totals);
  }

  // Returns the same Image through fallback/retries so existing canvas checks still work.
  function load(url, options){
    options = options || {};
    var image = new global.Image();
    var fallback = options.fallbackUrl || (/\.webp(?=[?#]|$)/i.test(url) ? url.replace(/\.webp(?=[?#]|$)/i, '.png') : null);
    var currentUrl = url;
    var retries = 0;
    var hadError = false;
    var finished = false;
    totals.pending++;

    function notify(state){
      if(options.onStatus) options.onStatus({ state: state, url: currentUrl, retries: retries, totals: getStatus() });
    }

    image.onload = function(){
      if(finished) return;
      finished = true;
      totals.pending--;
      totals.loaded++;
      if(hadError) totals.recovered++;
      image.onload = image.onerror = null;
      notify('loaded');
    };

    image.onerror = function(){
      if(finished) return;
      hadError = true;
      totals.errors++;
      if(fallback && currentUrl !== fallback){
        currentUrl = fallback;
        notify('fallback');
        image.src = currentUrl;
      }else if(retries < 2){
        retries++;
        totals.retries++;
        notify('retrying');
        global.setTimeout(function(){
          var parts = currentUrl.split('#');
          image.src = parts[0] + (parts[0].indexOf('?') === -1 ? '?' : '&') + 'r=' + retries + (parts.length > 1 ? '#' + parts.slice(1).join('#') : '');
        }, retries * 500);
      }else{
        finished = true;
        totals.pending--;
        totals.failed++;
        image.onload = image.onerror = null;
        notify('failed');
      }
    };

    notify('loading');
    image.src = currentUrl;
    return image;
  }

  global.FSRAssets = { load: load, getStatus: getStatus };
})(window);
