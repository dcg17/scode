var password = ""
var username = ""
var query = ''

var express = require('express');
var request = require('request');
var querystring = require('querystring');
var bodyParser = require('body-parser');
var fs = require('fs');

process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';

var allJiraDataArr = [];
var fieldMapping = [];
var jiraResultsFound = 0;
var fieldToReportOn = ["Issue Type", "Client", "Epic Link","Key","Summary","Assignee","Reporter","Priority",
                      "Status","Resolution","Created","Updated","Due Date","Σ Original Estimate",
                      "Σ Remaining Estimate","Time Spent","Source","Scrum team","Fix Version/s",
                      "Component/s","Code Branch","Labels","Business Process(es)",
                      "Issue Classification","Originator","Resolved","Epic Type","Epic Name"];
var userTypeFields = ["Reporter", "Assignee"];


getCustomFieldMapping();

function downloadJiraList(start, maxResults) {
  request.get(
      {
          url: "https://kainossmart.atlassian.net/rest/api/2/search?jql="+query+"&startAt="+start+"&maxResults="+maxResults,
          headers : {
              "Accept" : "application/json",
              "Authorization" : "Basic " + new Buffer(username + ":" + password).toString("base64")
          }
      }, function (error, response, body) {

        var responseJson = JSON.parse(body)
        jiraResultsFound = responseJson.total;
        parseJiraData(responseJson)

        //console.log(responseJson.issues)

        if((start+maxResults) < jiraResultsFound) {
          downloadJiraList(start+maxResults, maxResults)
        } else {
          console.log("All downloaded, count: "+allJiraDataArr.length)
          createCSVEntries();
        }
        
      });
}

function parseJiraData(rJson) {
  allJiraDataArr.push.apply(allJiraDataArr, rJson.issues);
  console.log("Results downloaded: "+allJiraDataArr.length+" / "+jiraResultsFound);
}

function getCustomFieldMapping() {
  request.get(
    {
        url: "https://kainossmart.atlassian.net/rest/api/2/field",
        headers : {
            "Accept" : "application/json",
            "Authorization" : "Basic " + new Buffer(username + ":" + password).toString("base64")
        }
    }, function (error, response, body) {

      var responseJson = JSON.parse(body)
      fieldMapping.push.apply(fieldMapping, responseJson)

      console.log("Custom Field Mapping count: "+fieldMapping.length)
      
      /* test mapping */
      //console.log(getNameFromFieldID("customfield_15122"))
      //console.log(getIDFromFieldName("AMS Ticket Resolution"))

      downloadJiraList(0,100);
    });
}

function getNameFromFieldID(id) {
  var found=false;
  var name="";
  
  fieldMapping.forEach(function(element) {
    if(!found) {
      if(element.id===id) {
        name = element.name;
      }
    }
  });
  return name;
}

function getIDFromFieldName(name) {
  var found=false;
  var id="";

  fieldMapping.forEach(function(element) {
    if(!found) {
      if(element.name===name) {
        id = element.id;
      }
    }
  });
  return id;
}

function reformatIfUserField(fieldName, value) {

  if(userTypeFields.indexOf(fieldName) > -1 && value == "") {
    return "Unassigned"
  }
  return value;
}

function createCSVEntries() {
    var fieldsToWrite = generateHeaderString();
    allJiraDataArr.forEach(function(jira) {
      var tempString = "";

     // console.log(jira.fields)

      fieldToReportOn.forEach(function(fieldName) {
        if(fieldName == "Key") {
          tempString = tempString + "\"" +  jira.key + "\","
        } else {
          var value = getValueFromField ( jira.fields[getIDFromFieldName(fieldName)] )
          
          value = reformatIfUserField(fieldName, value);

          // check if date, then format
          var dateCheck = Date.parse(value);
          if (isNaN(value) && !isNaN(dateCheck) && (value.substring(0, 1) != "K")) {

            //console.log(fieldName + " - " + value);

            var tempDate = new Date(value);
            value = tempDate.getDate() + "/" + tempDate.getMonth()+ "/" + tempDate.getFullYear() + " " + 
                    tempDate.getHours() + ":" + tempDate.getMinutes() + ":" + tempDate.getSeconds();
          }

          tempString = tempString + "\"" + value + "\",";
        }
      });

      fieldsToWrite = fieldsToWrite + "\n" + tempString;
    });
    writeToFile(fieldsToWrite)
}

function getValueFromField(field) {

  //console.log(field)

  if( field == null ) {
    return "";
  } else if ( Array.isArray(field) ) {
    if(field.length > 0) {
      var arrayString = ""
      field.forEach(function(entry) {
        if (entry.value != null) {
            arrayString = arrayString + entry.value + " & ";
        } else if (entry.name != null) {
           arrayString = arrayString + entry.name + " & ";
        } else if (entry != null) {
          arrayString = arrayString + entry + " & ";
        }
      })
      return arrayString.substring(0, arrayString.length-3)+"";
    } else {
      return "";
    } 
  } else if ( field.displayName != null ) {
    return field.displayName;
  } else if ( field.name != null ) {
    return field.name;
  } else if ( field.value != null ) {
    if(field.child != null && field.child.value != null) {
      return field.value + " - " + field.child.value;
    }     
    return field.value;
  } else if ( field.key != null ) {
    return field.key;
  } else if ( field != "" || field == "" ) {
    return field
  } 

  return ""
}

function generateHeaderString() {
  var headerString = "";
  fieldToReportOn.forEach(function(field) {
    headerString = headerString + field + ","
  });
  return headerString;
}

function writeToFile(contentsToWrite) {
  fs.writeFile("export.csv", contentsToWrite, function(err) {
    if(err) {
        return console.log(err);
    }

    console.log("The file was saved! - 'export.csv'");
}); 
}


