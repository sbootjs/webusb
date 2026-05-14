import { Transport }
  from "@sboot/core";

export class WebUSBTransport
  extends Transport {

  constructor(device) {
    super();

    this.device = device;

    this.interfaceNumber = null;

    this.inEndpoint = null;
    this.outEndpoint = null;
  }

  static async requestSamsungDevice() {
    const device =
      await navigator.usb.requestDevice({
        filters: [
          {
            vendorId: 0x04E8
          }
        ]
      });

    return new WebUSBTransport(device);
  }

  async connect() {
    console.log(
      "Opening Samsung USB device..."
    );

    await this.device.open();

    /*
      Select default config if missing
    */

    if (!this.device.configuration) {
      await this.device.selectConfiguration(1);
    }

    console.log(
      "USB configurations ready"
    );

    let selectedInterface = null;
    let selectedAlternate = null;

    /*
      Find Samsung bulk interface
    */

    for (
      const iface of
      this.device.configuration.interfaces
    ) {
      console.log(
        "Checking interface:",
        iface.interfaceNumber
      );

      for (
        const alternate of iface.alternates
      ) {
        let hasBulkIn = false;
        let hasBulkOut = false;

        console.log(
          "Alternate setting:",
          alternate.alternateSetting
        );

        for (
          const endpoint of alternate.endpoints
        ) {
          console.log({
            endpointNumber:
              endpoint.endpointNumber,

            direction:
              endpoint.direction,

            type:
              endpoint.type
          });

          if (
            endpoint.type === "bulk" &&
            endpoint.direction === "in"
          ) {
            hasBulkIn = true;
          }

          if (
            endpoint.type === "bulk" &&
            endpoint.direction === "out"
          ) {
            hasBulkOut = true;
          }
        }

        if (hasBulkIn && hasBulkOut) {
          selectedInterface = iface;

          selectedAlternate = alternate;

          break;
        }
      }

      if (selectedInterface) {
        break;
      }
    }

    if (!selectedInterface) {
      throw new Error(
        "Samsung bulk interface not found"
      );
    }

    this.interfaceNumber =
      selectedInterface.interfaceNumber;

    console.log(
      "Using interface:",
      this.interfaceNumber
    );

    /*
      Explicit alternate selection
      helps on Windows/WebUSB
    */

    await this.device.claimInterface(
      this.interfaceNumber
    );

    await this.device.selectAlternateInterface(
      this.interfaceNumber,
      selectedAlternate.alternateSetting
    );

    console.log(
      "Interface claimed"
    );

    /*
      Endpoint detection
    */

    for (
      const endpoint of selectedAlternate.endpoints
    ) {
      if (
        endpoint.type === "bulk" &&
        endpoint.direction === "in"
      ) {
        this.inEndpoint =
          endpoint.endpointNumber;
      }

      if (
        endpoint.type === "bulk" &&
        endpoint.direction === "out"
      ) {
        this.outEndpoint =
          endpoint.endpointNumber;
      }
    }

    console.log(
      "IN endpoint:",
      this.inEndpoint
    );

    console.log(
      "OUT endpoint:",
      this.outEndpoint
    );

    if (
      this.inEndpoint == null ||
      this.outEndpoint == null
    ) {
      throw new Error(
        "Bulk endpoints missing"
      );
    }
  }

  async write(data) {
    console.log(
      "USB OUT:",
      new Uint8Array(data)
    );

    const result =
      await this.device.transferOut(
        this.outEndpoint,
        data
      );

    if (result.status !== "ok") {
      throw new Error(
        `USB write failed: ${result.status}`
      );
    }

    return result;
  }

  async read(length = 512) {
    const result =
      await this.device.transferIn(
        this.inEndpoint,
        length
      );

    if (result.status !== "ok") {
      throw new Error(
        `USB read failed: ${result.status}`
      );
    }

    console.log(
      "USB IN:",
      new Uint8Array(
        result.data.buffer
      )
    );

    return result.data.buffer;
  }

  async close() {
    if (
      this.interfaceNumber != null
    ) {
      await this.device.releaseInterface(
        this.interfaceNumber
      );
    }

    await this.device.close();

    console.log(
      "USB device closed"
    );
  }
}
