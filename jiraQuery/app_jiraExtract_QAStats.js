var password = ""
var username = ""
var baseURL = "https://XXX.atlassian.net"
var query = 'project = "X" and type = bug'

var express = require('express');
var request = require('request');
var querystring = require('querystring');
var bodyParser = require('body-parser');
var fs = require('fs');
var HashMap = require('hashmap');
var read = require('read')

process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';

var allJiraDataArr = [];
var allJiraEpicDataArr = [];
var fieldMapping = [];
var jiraResultsFound = 0;
var epicListString = "";
var epicListArray = [];
var fieldToReportOn = ["Issue Type", "Client", "Epic Link","Key","Summary","Assignee","Reporter","Priority",
                      "Status","Resolution","Created","Updated","Due Date","Σ Original Estimate",
                      "Σ Remaining Estimate","Time Spent","Source","Scrum team","Fix Version/s",
                      "Component/s","Code Branch","Labels","Business Process(es)",
                      "Issue Classification","Originator","Resolved","Epic Type","Epic Name"];
var userTypeFields = ["Reporter", "Assignee"];



read({ prompt: 'Password: ', silent: true }, function(er, passwordFromUser) {
  password = passwordFromUser;
  getCustomFieldMapping()
})

function downloadJiraList(start, maxResults) {
  request.get(
      {
          url: baseURL+"/rest/api/2/search?jql="+query+"&startAt="+start+"&maxResults="+maxResults,
          headers : {
              "Accept" : "application/json",
              "Authorization" : "Basic " + new Buffer(username + ":" + password).toString("base64")
          }
      }, function (error, response, body) {

        var responseJson = JSON.parse(body)
        jiraResultsFound = responseJson.total;
        parseJiraData(responseJson)

        if((start+maxResults) < jiraResultsFound) {
          downloadJiraList(start+maxResults, maxResults)
        } else {
          console.log("All downloaded, count: "+allJiraDataArr.length)
          parseEpicNames();
        }
        
      });
}

var epicMap = new HashMap();

function isEpicMapped(epicName) {
  var found = false
    epicMap.forEach(function(value, key) {
      if(key === epicName) {
        found = true
      }
  });
    return found;
}

// update epicMap with 
function updateEpicMapNames() {
    allJiraEpicDataArr.forEach(function(jira) {
    if(jira.fields.customfield_10009 != null) {
      epicMap.set(jira.key, jira.fields.customfield_10009);
    }
  });

    updateJiraEpicValues()
}

function updateJiraEpicValues() {
  allJiraDataArr.forEach(function(jira) {
    if(jira.fields.customfield_10008 != null) {

      // replace commas in epic names too
      var value = getEpicMapping(jira.fields.customfield_10008);
       if (typeof value === 'string') {
             value = value.replace(/,/g, '.')
          }
      jira.fields.customfield_10008 = value;
    }
  });
  createCSVEntries();
}

function getEpicMapping(epicLink) {
  if(epicMap.get(epicLink) != null && epicMap.get(epicLink) != "") {
    return epicMap.get(epicLink);
  }
}

function parseEpicNames() {

  console.log("Working out epics...")
  
  
  allJiraDataArr.forEach(function(jira) {
    if(jira.fields.customfield_10008 != null) {
      epicListArray.push(jira.fields.customfield_10008)
      epicMap.set(jira.fields.customfield_10008, "");
    }
  });

  removeDuplicateEpicLinks()

  // kept maxResults low here as the URL it builds can get long quick... bare this in mind if you are seeing '<' errors
  downloadJiraEpics(0,30);
}

function removeDuplicateEpicLinks() {
  var uniqueEpicListArray = epicListArray.filter(function(item, pos) {
    return epicListArray.indexOf(item) == pos;
  })
  epicListArray = uniqueEpicListArray;
}

function downloadJiraEpics(iteration, maxResults) {

  epicListString = ""

  for(var i = 0; i<maxResults && ((iteration*maxResults)+i)<epicListArray.length; i++ ) {
    epicListString = epicListString + epicListArray[(iteration*maxResults)+i] + ","
  }
  epicListString = epicListString.substring(0,epicListString.length-1)

  request.get(
      {
          url: baseURL+"/rest/api/2/search?jql=key%20in%20("+epicListString+")&startAt=0&maxResults="+maxResults,
          headers : {
              "Accept" : "application/json",
              "Authorization" : "Basic " + new Buffer(username + ":" + password).toString("base64")
          }
      }, function (error, response, body) {

        var responseJson = JSON.parse(body)
        var jiraEpicResultsFound = responseJson.total;
        parseJiraEpicData(responseJson);

        if(((iteration*maxResults)+maxResults) < epicListArray.length) {
          downloadJiraEpics(iteration+1, maxResults)
        } else {
          console.log("Epics extracted - updating mapping")
          updateEpicMapNames()
        }        
      });
}

function parseJiraEpicData(rJson) {
  allJiraEpicDataArr.push.apply(allJiraEpicDataArr, rJson.issues);
  console.log("Results downloaded (Epics): "+allJiraEpicDataArr.length+" so far");
}

function parseJiraData(rJson) {
  allJiraDataArr.push.apply(allJiraDataArr, rJson.issues);
  console.log("Results downloaded (Jiras): "+allJiraDataArr.length+" / "+jiraResultsFound);
}

function getCustomFieldMapping() {
  request.get(
    {
        url: baseURL+"/rest/api/2/field",
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

      fieldToReportOn.forEach(function(fieldName) {
        if(fieldName == "Key") {
          tempString = tempString + "\"" +  jira.key + "\","
        } else {
          var value = getValueFromField ( jira.fields[getIDFromFieldName(fieldName)] )

          //replace commas to avoid breaking CSV file
          if (typeof value === 'string') {
             value = value.replace(/,/g, '.')
          }
          value = reformatIfUserField(fieldName, value);

         if (fieldName !== "Summary" && fieldName !== "Epic Link") {
              // check if date, then format
              var dateCheck = Date.parse(value);
              if (isNaN(value) && !isNaN(dateCheck) && (value.substring(0, 1) != "K")) {

                var tempDate = new Date(value);
                value = tempDate.getDate() + "/" + (tempDate.getMonth()+1)+ "/" + tempDate.getFullYear() + " " + 
                        tempDate.getHours() + ":" + tempDate.getMinutes() + ":" + tempDate.getSeconds();
              }
            }

          if(fieldName === "Resolution" && value === "") {
            value = "Unresolved"
          }

          tempString = tempString + "\"" + value + "\",";
        }
      });

      fieldsToWrite = fieldsToWrite + "\n" + tempString;
    });
    writeToFile(replaceUTCCharacters(fieldsToWrite))
}


function getValueFromField(field) {

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


function replaceUTCCharacters(value) {
  value = value.replace(/Ą/g, 'A')
  value = value.replace(/Ć/g, 'C')
  value = value.replace(/Ę/g, 'E')
  value = value.replace(/Ł/g, 'L')
  value = value.replace(/Ń/g, 'N')
  value = value.replace(/Ó/g, 'O')
  value = value.replace(/Ś/g, 'S')
  value = value.replace(/Ź/g, 'Z')
  value = value.replace(/Ż/g, 'Z')
  value = value.replace(/ą/g, 'a')
  value = value.replace(/ć/g, 'c')
  value = value.replace(/ę/g, 'e')
  value = value.replace(/ł/g, 'l')
  value = value.replace(/ń/g, 'n')
  value = value.replace(/ó/g, 'o')
  value = value.replace(/ś/g, 's')
  value = value.replace(/ź/g, 'z')
  value = value.replace(/ż/g, 'z')
  return value;
}


