var express = require('express');
var bodyParser = require('body-parser');
var app = express();
var fs = require('fs');
var glob = require( 'glob' );

var allFiles = [];
var fileExtensions = "{mkv,avi,mp4}";
var downloadFolderList = ["/home/pi/folder1/*",
						  "/home/pi/folder1/*/*"];

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
	var dir = "/home/pi/plex/TVFOLDER/"
	var id = req.params.id;
	moveFile(allFiles[id], dir, allFiles[id].split("/")[allFiles[id].split("/").length-1])
	res.render("redirect.ejs")
});

app.get('/tv-usb/:id', function (req, res) {
	var dir = "/media/pi/USB/tv"
	var id = req.params.id;
	moveFile(allFiles[id], dir, allFiles[id].split("/")[allFiles[id].split("/").length-1])
	res.render("redirect.ejs")
});

app.get('/movies/:id', function (req, res) {
	var dir = "/home/pi/plex/MOVIEFOLDER/"
	var id = req.params.id;
	moveFile(allFiles[id], dir, allFiles[id].split("/")[allFiles[id].split("/").length-1])
	res.render("redirect.ejs")
});

app.get('/movies-usb/:id', function (req, res) {
	var dir = "/media/pi/USB/movies/"
	var id = req.params.id;
	moveFile(allFiles[id], dir, allFiles[id].split("/")[allFiles[id].split("/").length-1])
	res.render("redirect.ejs")
});

app.get('/delete/:id', function (req, res) {
	var id = req.params.id;
	fs.unlink(allFiles[id])
	res.render("redirect.ejs")
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
