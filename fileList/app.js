var express = require('express');
var bodyParser = require('body-parser');
var app = express();
var fs = require('fs');
var glob = require( 'glob' );

var allFiles = [];
var fileExtensions = "{mkv,avi,mp4}";
var downloadFolderList = ["/Users/davidgil/Development/FileList/examples/*",
						  "/Users/davidgil/Development/FileList/examples/*/*"];

var server = app.listen(8080, function () {
   var host = server.address().address
   var port = server.address().port
   
   console.log("[+] Server starting on http://%s:%s", host, port)
})

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

function moveFile(fileFrom, fileTo, fileName) {
	console.log("From: "+fileFrom+" ---> "+fileTo+fileName)
	fs.rename(fileFrom, fileTo+fileName, function (err) {
	  if (err) throw err
	  console.log('Successfully moved!')
	})
}


app.get('/tv/:id', function (req, res) {
	var dir = "~/plexmedia/tv/"
	var id = req.params.id;
	moveFile(allFiles[id], dir, allFiles[id].split("/")[allFiles[id].split("/").length-1])
});

app.get('/tv-usb/:id', function (req, res) {
	var dir = "/media/pi/5A54-2EB816/tv/"
	var id = req.params.id;
	moveFile(allFiles[id], dir, allFiles[id].split("/")[allFiles[id].split("/").length-1])
});

app.get('/movies/:id', function (req, res) {
	var dir = "~/plexmedia/movies/"
	var id = req.params.id;
	moveFile(allFiles[id], dir, allFiles[id].split("/")[allFiles[id].split("/").length-1])
});

app.get('/movies-usb/:id', function (req, res) {
	var dir = "/media/pi/5A54-2EB816/movies/"
	var id = req.params.id;
	moveFile(allFiles[id], dir, allFiles[id].split("/")[allFiles[id].split("/").length-1])
});

app.get('/delete/:id', function (req, res) {
	var id = req.params.id;
	console.log(allFiles[id])
	fs.unlink(allFiles[id])
	});

app.get('/', function (req, res) {
	checkFolders();
	res.render("list.ejs", {allFiles:allFiles})
})

function checkFolders() {
	allFiles=[];
	for(var i=0; i<downloadFolderList.length; i++) {
			var files = glob( downloadFolderList[i]+'.'+fileExtensions, { sync: true } )
			allFiles = allFiles.concat(files);
	};
}
