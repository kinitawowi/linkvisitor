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

function markAll(visited, doPost) {
    var links = document.links;
    if (links == undefined || links.length == 0)
	return;

    var hrefs = [];
    for (var i = 0; i < links.length; i++) {
	hrefs[i] = links[i].href;
    }

    if (doPost)
	self.postMessage({"hrefs" : hrefs, "visited" : visited });
    else
	self.port.emit("markLinks", hrefs, visited);
    
    if (!visited) {  // wait a moment for the work to be done,  then refresh all links.
	window.setTimeout(function() {
	      for (var i in links) {
		  let aNode = links[i];
		  var oldHref = aNode.href;
		  aNode.href = '';
		  aNode.href = oldHref;
	      }
	    }, 1000);
    }
}

self.port.on("markAll", markAll );

self.on("click", 
	function (node, data) {
	    markAll(data == "true", true);
	});

