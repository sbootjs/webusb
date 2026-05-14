import { Transport } from "../../sboot-core/src/transport.js";

export class WebUSBTransport extends Transport {
  constructor(device) {
    super();

    this.device = device;
    this.interfaceNumber = null;
    this.inEndpoint = null;
    this.outEndpoint = null;
  }

  static async requestSamsungDevice() {
    const device = await navigator.usb.requestDevice({
      filters: [{ vendorId: 0x04E8 }]
    });

    return new WebUSBTransport(device);
  }

  async connect() {
    await this.device.open();

    if (!this.device.configuration) {
      await this.device.selectConfiguration(1);
    }

    let selectedInterface = null;

    for (const iface of this.device.configuration.interfaces) {
      for (const alternate of iface.alternates) {
        let hasBulkIn = false;
        let hasBulkOut = false;

        for (const endpoint of alternate.endpoints) {
          if (endpoint.type === "bulk" &&
              endpoint.direction === "in") {
            hasBulkIn = true;
          }

          if (endpoint.type === "bulk" &&
              endpoint.direction === "out") {
            hasBulkOut = true;
          }
        }

        if (hasBulkIn && hasBulkOut) {
          selectedInterface = iface;
          break;
        }
      }
    }

    if (!selectedInterface) {
      throw new Error("Samsung bulk interface not found");
    }

    this.interfaceNumber =
      selectedInterface.interfaceNumber;

    await this.device.claimInterface(
      this.interfaceNumber
    );

    const alt =
      selectedInterface.alternates[0];

    for (const endpoint of alt.endpoints) {
      if (endpoint.direction === "in") {
        this.inEndpoint =
          endpoint.endpointNumber;
      }

      if (endpoint.direction === "out") {
        this.outEndpoint =
          endpoint.endpointNumber;
      }
    }

    console.log("Connected");
  }

  async write(data) {
    return this.device.transferOut(
      this.outEndpoint,
      data
    );
  }

  async read(length = 512) {
    const result = await this.device.transferIn(
      this.inEndpoint,
      length
    );

    return result.data.buffer;
  }

  async close() {
    await this.device.releaseInterface(
      this.interfaceNumber
    );

    await this.device.close();
  }
}
