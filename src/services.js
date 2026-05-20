const { DEFAULT_SERVICES } = require("./defaults");

module.exports = {
  SERVICES: DEFAULT_SERVICES,
  DEFAULT_SERVICES,
  getServiceById(id) {
    return DEFAULT_SERVICES.find((service) => service.id === id);
  }
};
