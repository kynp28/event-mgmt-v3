--- Distinct Output 1 (Seen 10 times) ---

=== Concurrency Test (Prisma.join Rewrite) ===
V1 Status: 201
V1 Body: {
  id: '<ID>',
  vendorId: '<ID>',
  eventId: '<ID>',
  status: 'PAYMENT_PENDING',
  totalAmount: '100',
  holdExpiresAt: '<TS>',
  rejectionCount: 0,
  createdAt: '<TS>',
  updatedAt: '<TS>',
  items: [
    {
      id: '<ID>',
      bookingId: '<ID>',
      boothId: '<ID>',
      price: '100',
      booth: [Object]
    }
  ]
}
V2 Status: 409
V2 Body: {
  error: {
    code: 'BOOTHS_UNAVAILABLE',
    message: 'One or more booths are no longer available'
  }
}


