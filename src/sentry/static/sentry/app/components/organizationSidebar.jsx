/*** @jsx React.DOM */

var React = require("react");

var AppState = require("../mixins/appState");
var ConfigStore = require("../stores/configStore");
var DropdownLink = require("./dropdownLink");
var MenuItem = require("./menuItem");
var Gravatar = require("./gravatar");
var ListLink = require("./listLink");
var OrganizationState = require("../mixins/organizationState");
var PropTypes = require("../proptypes");

var OrganizationSelector = React.createClass({
  mixins: [AppState, OrganizationState],

  render() {
    var activeOrg = this.getOrganization();

    return (
      <DropdownLink
          topLevelClasses="org-selector anchor-right"
          onOpen={this.onDropdownOpen}
          onClose={this.onDropdownClose}
          title={activeOrg.name}>
        {this.getOrganizationList().map((org) => {
          return (
            <MenuItem key={org.slug} to="organizationDetails" params={{orgId: org.slug}}>
              {org.name}
            </MenuItem>
          );
        })}
      </DropdownLink>
    );
  }
});

var UserNav = React.createClass({
  propTypes: {
    user: PropTypes.User.isRequired
  },

  render() {
    var user = this.props.user;
    var urlPrefix = ConfigStore.get('urlPrefix');

    return (
      <div className="user-nav">
        <Gravatar email={user.email} className="avatar" />
        <div className="user-details">
          <span className="user-name truncate">{user.name || user.email}</span>
          <ul>
            <li><a href={urlPrefix + '/account/settings/'}>Account</a></li>
            <li><a href={urlPrefix + '/auth/logout/'}>Sign out</a></li>
          </ul>
        </div>
      </div>
    );
  }
});

var OrganizationSidebar = React.createClass({
  mixins: [AppState, OrganizationState],

  render() {
    var activeOrg = this.getOrganization();
    if (!activeOrg) {
      // TODO(dcramer): handle this case better
      return <div />;
    }

    var user = ConfigStore.get('user');

    return (
      <div className="app-sidebar">
        <OrganizationSelector />
        <div className="app-sidebar-content">
          <div className="teams">
            {activeOrg.teams.map((team, teamIdx) => {
              var routeParams = {
                orgId: activeOrg.slug,
                teamId: team.slug
              };
              return (
                <div className="team" key={team.slug}>
                  <h6>
                    <a className="pull-right" href="">
                      <span className="icon-settings" />
                    </a>
                    <Router.Link
                        to="teamDetails"
                        params={routeParams}>
                      {team.name}
                    </Router.Link>
                  </h6>
                  <ul className="project-list list-unstyled truncate">
                    {team.projects.map((project) => {
                      var routeParams = {
                        orgId: activeOrg.slug,
                        projectId: project.slug
                      };
                      return (
                        <ListLink
                            to="projectDetails"
                            params={routeParams}
                            key={project.slug}>
                          {project.name}
                        </ListLink>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
        {user &&
          <UserNav user={user} />
        }
      </div>
    );
  }
});

module.exports = OrganizationSidebar;
