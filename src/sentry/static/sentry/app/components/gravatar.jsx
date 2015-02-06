/*** @jsx React.DOM */

var React = require("react");
var $ = require("jquery");
var MD5 = require("crypto-js/md5");

var Gravatar = React.createClass({
  propTypes: {
    email: React.PropTypes.string.isRequired,
    size: React.PropTypes.number,
    default: React.PropTypes.string
  },

  getDefaultProps() {
    return {
      size: 64
    };
  },

  buildGravatarUrl() {
    var url = "https://secure.gravatar.com/avatar/";

    url += MD5(this.props.email.toLowerCase());

    var query = {
      s: this.props.size || undefined,
      d: this.props.default || undefined
    };

    url += "?" + $.param(query);

    return url;
  },

  render() {
    return (
      <img src={this.buildGravatarUrl()} />
    );
  }
});

module.exports = Gravatar;
