/*** @jsx React.DOM */

var React = require("react");

var ConfigStore = require("../stores/configStore");
var ListLink = require("../components/listLink");
var OrganizationState = require("../mixins/organizationState");

var OrganizationHomeSidebar = React.createClass({
  mixins: [OrganizationState],

  componentWillMount() {
    // Handle out of scope classes with jQuery
    jQuery(document.body).addClass("show-rightbar");
  },

  componentWillUnmount() {
    // Handle out of scope classes with jQuery
    jQuery(document.body).removeClass("show-rightbar");
  },

  render() {
    var access = this.getAccess();
    var features = this.getFeatures();
    var org = this.getOrganization();
    var orgParams = {orgId: org.slug};
    var urlPrefix = ConfigStore.get('urlPrefix') + '/organizations/' + org.slug;

    return (
      <div className="rightbar">
        <ul className="nav nav-stacked">
          <ListLink to="organizationTeams" params={orgParams}>Teams</ListLink>
          {access.has('org:read') &&
            <li><a href={urlPrefix + '/stats/'}>Stats</a></li>
          }
          {access.has('org:write') &&
            <li><a href={urlPrefix + '/audit-log/'}>Audit Log</a></li>
          }
          {access.has('org:read') &&
            <li><a href={urlPrefix + '/members/'}>Members</a></li>
          }
          {features.has('organizations:sso') && access.has('org:write') &&
            <li><a href={urlPrefix + '/auth/'}>Auth</a></li>
          }
          {access.has('org:write') &&
            <li><a href={urlPrefix + '/settings/'}>Settings</a></li>
          }
        </ul>
      </div>
    );
  }
});

module.exports = OrganizationHomeSidebar;
