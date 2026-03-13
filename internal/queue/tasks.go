package queue

const (
	TypeGetPhone = "otp:get_phone"
	TypePollOTP  = "otp:poll_otp"
	TypeRefund   = "otp:refund"
)

type GetPhonePayload struct {
	TransactionID uint `json:"transaction_id"`
}

type PollOTPPayload struct {
	TransactionID uint `json:"transaction_id"`
	Attempt       int  `json:"attempt"`
}

type RefundPayload struct {
	TransactionID uint   `json:"transaction_id"`
	Reason        string `json:"reason"`
}
