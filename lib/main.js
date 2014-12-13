/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * Contributor(s): Kinitawowi <linkvisitor@kmilburn.me.uk> https://addons.mozilla.org/en-US/firefox/addon/link-visitor-3/
 * 
 * Old Contributor(s): Billy <lamekisser@yahoo.co.uk> http://linkvisitor.mozdev.org/
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

var self = require("sdk/self");
var tabs = require("sdk/tabs");
var timer = require('sdk/timers');
var { Cc, Ci } = require('chrome');
var preferences = require("sdk/simple-prefs");
var {Hotkey} = require("sdk/hotkeys");
var notifications = require("sdk/notifications");
var _ = require("sdk/l10n").get;

/*
  <div>Icon made by <a href="http://www.freepik.com" title="Freepik">Freepik</a> from <a href="http://www.flaticon.com" title="Flaticon">www.flaticon.com</a> is licensed under <a href="http://creativecommons.org/licenses/by/3.0/" title="Creative Commons BY 3.0">CC BY 3.0</a></div>
 */ 

var LinkVisitor = {
    _bookmarksService : Cc['@mozilla.org/browser/nav-bookmarks-service;1'].getService(Ci.nsINavBookmarksService),
    _browserHistory : Cc["@mozilla.org/browser/nav-history-service;1"].getService(Ci.nsIBrowserHistory),
    _history : Cc["@mozilla.org/browser/history;1"].getService(Ci.mozIAsyncHistory),
    _URIFixup : Cc["@mozilla.org/docshell/urifixup;1"].getService(Ci.nsIURIFixup),

    _working : false,
    _lastProcessed : 0,
    _urisToProcess : null,
    _errorShown : false,
    
    _updatePlacesCallback : {
	  handleError : function(aResultCode, aPlaceInfo) {},
	  handleResult : function(aPlaceInfo) {},
	  handleCompletion: function () { 
	    LinkVisitor._lastProcessed++; 
	    LinkVisitor._addPageURI();
	  }
    },
	  
    _getFixupURI : function(uri) {
	var fixedURI = this._URIFixup.createFixupURI(uri, 0);
	return fixedURI;
    },
    
    _visitedAddCallback : function(pageURI, isVisited) {
        if (isVisited) {
	  LinkVisitor._updatePlacesCallback.handleCompletion();
	  return;
	}
	  
	LinkVisitor._history.updatePlaces({uri: pageURI, visits: [{ 
				    transitionType: Ci.nsINavHistoryService.TRANSITION_LINK,
				    visitDate: Date.now() * 1000}]},
				   LinkVisitor._updatePlacesCallback);    
    },
  
    _addPageURI : function() {
	if (LinkVisitor._lastProcessed < LinkVisitor._urisToProcess.length) { 
// 	    if (LinkVisitor._toolbarButton != null)
// 		LinkVisitor._toolbarButton.badge = LinkVisitor._urisToProcess.length - LinkVisitor._lastProcessed;
	   
	    LinkVisitor._history.isURIVisited(LinkVisitor._urisToProcess[LinkVisitor._lastProcessed], LinkVisitor._visitedAddCallback);
	}
	else {
// 	    if (LinkVisitor._toolbarButton != null)
// 		LinkVisitor._toolbarButton.badge = "";
	    
	    LinkVisitor._urisToProcess = null;
	    timer.clearInterval( LinkVisitor._intervalID );
	    
	    if (LinkVisitor._errorShown) {
		notifications.notify({
		      title: _("Title"),
		      iconURL:  self.data.url("icon-32.png"),
		      text: _("Finished"),
		});
	    }
	}      
    },
    
     _isBookmarked : function(url) {
      try {
	var found = LinkVisitor._bookmarksService.isBookmarked(url);
	return found;
      }
      catch(e) {
	return false;
      }
    },
    
    _removePageURI : function() {
	if (LinkVisitor._lastProcessed < LinkVisitor._urisToProcess.length) { 
	  var uri = LinkVisitor._urisToProcess[LinkVisitor._lastProcessed++];
	  if (LinkVisitor._bookmarksVisited && LinkVisitor._isBookmarked(uri))
		console.log(_("Bookmarked", uri.asciiSpec));
	    else
	      LinkVisitor._browserHistory.removePage(uri);
	}
	else {
	  LinkVisitor._urisToProcess = null;
	  timer.clearInterval( LinkVisitor._intervalID );
	}   
    },
    
    markLinks : function(hrefs, visited, window) {
      if (LinkVisitor._urisToProcess != null && LinkVisitor._urisToProcess.length - LinkVisitor._lastProcessed > 0) {
	  LinkVisitor._errorShown = true;
	  notifications.notify({
		title: _("Title"),
		iconURL:  self.data.url("icon-32.png"),
		text: _("Working", LinkVisitor._urisToProcess.length - LinkVisitor._lastProcessed )
	  });
	  return;
      }
      
      LinkVisitor._errorShown = false;

      LinkVisitor._urisToProcess = [];
      for(var i = 0; i < hrefs.length; ++i ) {
	  LinkVisitor._urisToProcess[i] = LinkVisitor._getFixupURI(hrefs[i]);
      }
      LinkVisitor._lastProcessed = 0;
      
      if (visited) {
	LinkVisitor._addPageURI();
      }
      else {
	// Note: If removing fewer than 10 pages, calling _browserHistory.removePage() repeatedly is preferable over calling _browserHistory.removePages()
	if (hrefs.length <= 10)
	    LinkVisitor._intervalID = timer.setInterval(LinkVisitor._removePageURI, 10);
	else {
	    LinkVisitor._browserHistory.removePages(LinkVisitor._urisToProcess, LinkVisitor._urisToProcess.length, false);
	    LinkVisitor._urisToProcess = null;
	}
      }
    },
    
    markAll : function(visited) {
       var worker = tabs.activeTab.attach({
	  contentScriptFile: self.data.url("visit-all.js")
       });
        
       worker.port.emit("markAll", visited);
       worker.port.on("markLinks", LinkVisitor.markLinks);
    },
    
    markSelected : function(visited) {
       var worker = tabs.activeTab.attach({
	  contentScriptFile: self.data.url("visit-selected.js")
       });
        
       worker.port.emit("markSelected", visited);
       worker.port.on("markLinks", LinkVisitor.markLinks);
    },
     
    _visitedToggleCallback : function(pageURI, isVisited) {
        if (isVisited) {
	    if (LinkVisitor._bookmarksVisited && LinkVisitor._isBookmarked(pageURI))
		notifications.notify({
		    title: _("Title"),
		    iconURL:  self.data.url("icon-32.png"),
		    text: _("Bookmarked", pageURI.asciiSpec)
		});
	    else
		LinkVisitor._browserHistory.removePage(pageURI);
	}
	else {
	    LinkVisitor._history.updatePlaces({uri: pageURI, visits: [{ 
				    transitionType: Ci.nsINavHistoryService.TRANSITION_LINK,
				    visitDate: Date.now() * 1000}]},
				   null);
	}
    },
    
    toggleVisited : function(node) {
      LinkVisitor._history.isURIVisited(LinkVisitor._getFixupURI(node), LinkVisitor._visitedToggleCallback);
    },
    
    //Preference Handling
    _loadedPreferences: false,
    _bookmarksVisited : false,
    _markAllVisitedKey : null,
    _markAllUnvisitedKey : null,
    _markSelectedVisitedKey : null,
    _markSelectedUnvisitedKey : null,
    _doOverrideColour: false,
    _overrideColour: null,
    _overrideExceptions: null,
    
    loadPreferences : function() {
      LinkVisitor._updatePreference('bookmarksVisited');
      LinkVisitor._updatePreference('visitAllKey');
      LinkVisitor._updatePreference('unvisitAllKey');
      LinkVisitor._updatePreference('visitSelectedKey');
      LinkVisitor._updatePreference('unvisitSelectedKey');
      LinkVisitor._updatePreference('showInToolbar');
      LinkVisitor._updatePreference('doOverrideColour');
      LinkVisitor._updatePreference('overrideColour');
      LinkVisitor._updatePreference('overrideExceptions');
      LinkVisitor._loadedPreferences = true;
      LinkVisitor._setupColourOverride(true);
      
      preferences.on('', LinkVisitor._updatePreference );
    },
    
    _updatePreference : function(prefName) {
	var value = preferences.prefs[prefName];
	switch (prefName) {
	    case 'bookmarksVisited':
		LinkVisitor._bookmarksVisited = value;
		break;
		
	    case 'visitAllKey':
		LinkVisitor._markAllVisitedKey = LinkVisitor._configureKey(LinkVisitor._markAllVisitedKey, value, 
									    function() { LinkVisitor.markAll(true); });
		break;
		
	    case 'unvisitAllKey':
		LinkVisitor._markAllUnvisitedKey = LinkVisitor._configureKey(LinkVisitor._markAllUnvisitedKey, value, 
									    function() { LinkVisitor.markAll(false); });
		break;
		
	    case 'visitSelectedKey':
		LinkVisitor._markSelectedVisitedKey = LinkVisitor._configureKey(LinkVisitor._markSelectedVisitedKey, value, 
									    function() { LinkVisitor.markSelected(true); });
		break;
		
	    case 'unvisitSelectedKey':
		LinkVisitor._markSelectedUnvisitedKey = LinkVisitor._configureKey(LinkVisitor._markSelectedUnvisitedKey, value, 
									    function() { LinkVisitor.markSelected(false); });
		break;
		
	    case 'showInToolbar':
		LinkVisitor._showToolbarButton(value);
		break;
		
	    case 'doOverrideColour':
		LinkVisitor._doOverrideColour = value;
		LinkVisitor._setupColourOverride(true);
		break
		
	    case 'overrideColour':
		LinkVisitor._overrideColour = value;		
		LinkVisitor._setupColourOverride(false);
		break;
		
	    case 'overrideExceptions':
		LinkVisitor._overrideExceptions = value.length > 0 ? value.split(",") : null;
		LinkVisitor._setupColourOverride(false);
		break;

	}
    },
    
    getSiteColour: function(siteUrl) {
	if (LinkVisitor._overrideExceptions != null && LinkVisitor._overrideExceptions.length > 0) {
	    var site = require("sdk/url").URL(siteUrl).host;
	    
	    for (var i in LinkVisitor._overrideExceptions) {
	      var exception =  LinkVisitor._overrideExceptions[i].trim();
	      var index = exception.indexOf(":");
	      var colour = ""
	      if (index != -1)  {
		 colour = exception.substring(index + 1).trim();
		 exception = exception.substring(0, index).trim();
	      }
	      
	      if (site == exception || site.substring(site.length - exception.length) == exception)
		  return colour;
	    }
	}
	
	return LinkVisitor._overrideColour;
    },
    
    _setupColourOverride: function(toggled) {
	if (!LinkVisitor._loadedPreferences)
	  return;
	
	var pageMod = require("sdk/page-mod");
	if (LinkVisitor._doOverrideColour) {
	    for (var i in tabs) {
		if (!tabs[i].url.startsWith(_("about"))) {
		    var worker = tabs[i].attach({
			  contentScriptFile: self.data.url("overrideStyle.js"),
		    });

		    worker.port.emit("overrideColour", LinkVisitor.getSiteColour(worker.url));
		}
	    }
	    
	    mod = pageMod.PageMod({
			include: "*",
			contentScriptWhen: "ready",
			contentScriptFile: self.data.url("overrideStyle.js"),
			onAttach: function(worker) {
			    if (!worker.url.startsWith("about:") && LinkVisitor._doOverrideColour)
				worker.port.emit("overrideColour", LinkVisitor.getSiteColour(worker.url));
			}
	    });
	}
	else {
	    for (var i in tabs) {
		if (!tabs[i].url.startsWith(_("about"))) {
		    var worker = tabs[i].attach({
			  contentScriptFile: self.data.url("overrideStyle.js"),
		    });

		    worker.port.emit("overrideColour", "");
		}
	    }
	}
    },
    
    _configureKey: function(existingKey, newValue, pressFunc) {
	if (existingKey != null)
	    existingKey.destroy();
	
	if (newValue.length > 0) {
	    try {
	      return Hotkey({
			combo: newValue,
			onPress: pressFunc
	      });
	    }
	    catch(e) {}
	}
	
	return null;
    },
    
    _toolbarPanel : null,
    _toolbarButton : null,
    
    _panelCallback : function(url) {
	LinkVisitor._toolbarPanel.hide();
	LinkVisitor.markAll(url.substring(url.indexOf('#') + 1) == "true");
    },
		
    _showToolbarButton : function(show) {
	if (show) {
	    var { ToggleButton } = require('sdk/ui/button/toggle');
	    var panels = require("sdk/panel");
	  
	    //Let's fake a menu as there's no easy way to do this...  :(
	    
	    var callbackScript = "window.addEventListener('click', function(event) {" +
			  "  if (event.target.nodeName == 'A')" +
			  "    self.port.emit('click-link', event.target.toString());" +
			  "}, false);"
			  
	    if (LinkVisitor._toolbarPanel == null)
	    LinkVisitor._toolbarPanel = panels.Panel({
		contentURL: self.data.url("menu.html"),
		contentScript: callbackScript,
		width: 190,
		height: 62,
		onHide: function () {
		      LinkVisitor._toolbarButton.state('window', {checked: false});
		}
	    });

	    LinkVisitor._toolbarPanel.port.on("click-link", LinkVisitor._panelCallback);

	    LinkVisitor._toolbarButton = ToggleButton({
		id: "link-visitor",
		label: _("ButtonLabel"),
		icon: {
		  "16": "./icon-16.png",
		  "32": "./icon-32.png",
		  "64": "./icon-64.png"
		},	
// 		badge: "",
// 		badgeColor: "#008000",
		onClick: function(state) {
			    if (state.checked) {
			      LinkVisitor._toolbarPanel.show({
				position: LinkVisitor._toolbarButton
			      });
			    }
			}
	    });
	}
	else {    
	    if (LinkVisitor._toolbarPanel != null) {
		LinkVisitor._toolbarPanel.port.removeListener("click-link", LinkVisitor._panelCallback);
		
		//destorying the panel results in NS_ERROR_FAILURE from nsIObserverService.removeObserver
// 		LinkVisitor._toolbarPanel.destroy();
	    }
	    
	    if (LinkVisitor._toolbarButton != null) 
		LinkVisitor._toolbarButton.destroy();	
		    
// 	    LinkVisitor._toolbarPanel = null;
	    LinkVisitor._toolbarButton = null;
	}
    },
    
    _toggleVisitedItem: null,
    _markSelectedItem: null,
    _markAllItem: null,
    
    setupContextMenu : function() {
	var cm = require("sdk/context-menu");
	LinkVisitor:_toggleVisitedItem = cm.Item({
	    label: _("ToggleLabel"),
	    context: cm.SelectorContext("a"),
	    contentScriptFile: self.data.url("toggle-status.js"),
	    image: self.data.url("icon-16.png"),
	    accessKey: 'v',
	    onMessage: function (href) {
	      LinkVisitor.toggleVisited(href);
	    }
	});

	LinkVisitor:_markSelectedItem = cm.Menu({
	    label: _("MarkSelectedLabel"),
	    context: cm.SelectionContext(),
	    contentScriptFile: self.data.url("visit-selected.js"),
	    image: self.data.url("icon-16.png"),
	    items: [
		cm.Item({ label: _("VisitedLabel"), data: "true" }),
		cm.Item({ label: _("UnvisitedLabel"), data: "false" })
	    ],
	    onMessage: function(data) {
		LinkVisitor.markLinks(data.hrefs, data.visited);
	    }
	});

	LinkVisitor:_markAllItem = cm.Menu({
	    label: _("MarkAllLabel"),
	    contentScriptFile: self.data.url("visit-all.js"),
	    image: self.data.url("icon-16.png"),
	    items: [
		cm.Item({ label: _("VisitedLabel"), data: "true" }),
		cm.Item({ label: _("UnvisitedLabel"), data: "false" })
	    ],
	    onMessage: function(data) {
		LinkVisitor.markLinks(data.hrefs, data.visited);
	    }
	});
    },
};

exports.main = function(options, callbacks) {
    LinkVisitor.loadPreferences();
    LinkVisitor.setupContextMenu();
}

exports.onUnload = function (reason) {
   preferences.removeListener('', LinkVisitor._updatePreference );
   LinkVisitor:_toggleVisitedItem.destroy();
   LinkVisitor:_markSelectedItem.destroy();
   LinkVisitor:_markAllItem.destroy();
   LinkVisitor._showToolbarButton(false);
}