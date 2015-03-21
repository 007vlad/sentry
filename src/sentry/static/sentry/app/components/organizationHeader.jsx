/*** @jsx React.DOM */

var React = require("react");

var AppState = require("../mixins/appState");
var Breadcrumbs = require("./breadcrumbs");
var OrganizationState = require("../mixins/organizationState");

var OrganizationHeader = React.createClass({
  mixins: [AppState, OrganizationState],

  render() {
    return (
      <header>
        <div className="container">
          <Breadcrumbs />
         </div>
      </header>
    );
  }
});

module.exports = OrganizationHeader;
